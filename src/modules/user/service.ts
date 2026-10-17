import { auth } from "../../auth"
import { hasPermission, isRoleName, permissionsFor, type RoleName } from "../../auth/permissions"
import { env } from "../../env"
import type { Locale } from "../../i18n"
import { t } from "../../i18n"
import type { Actor } from "../../lib/actor"
import { failT } from "../../lib/error"
import { assertOwnerOrPermission } from "../../lib/ownership"
import { paginated } from "../../lib/response"
import { sanitizeText } from "../../lib/sanitize"
import { extensionFromFilename } from "../../lib/storage/keys"
import { getStorage } from "../../lib/storage"
import type { UserModel } from "./model"
import { userRepository, type UserRecord } from "./repository"

const AVATAR_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp"])

/**
 * Public user DTO — response “sanitize”: omit secrets (password/hash/token never included).
 * Not HTML escape; Elysia input `sanitize` + frontend rendering handle XSS.
 */
export function toPublicUser(row: UserRecord): UserModel["profile"] {
	return {
		id: row.id,
		name: row.name,
		email: row.email,
		image: row.image ?? null,
		role: row.role,
		banned: row.banned ?? false,
		emailVerified: row.emailVerified,
		createdAt: row.createdAt.toISOString(),
	}
}

export abstract class UserService {
	static async me(actor: Actor, locale: Locale = env.DEFAULT_LOCALE) {
		return UserService.getById(actor, actor.id, locale)
	}

	static access(actor: Actor) {
		const permissions = permissionsFor(actor.role)
		return {
			role: actor.role,
			permissions: Object.fromEntries(
				Object.entries(permissions).map(([resource, actions]) => [resource, [...actions]]),
			),
		}
	}

	static async getById(actor: Actor, id: string, locale: Locale = env.DEFAULT_LOCALE) {
		assertOwnerOrPermission(
			actor,
			id,
			{ user: ["get"] },
			t(locale, "errors.cannotViewUser"),
		)

		const row = await userRepository.findById(id)
		if (!row) failT(locale, 404, "NOT_FOUND", "errors.userNotFound")
		return toPublicUser(row)
	}

	static async updateMe(actor: Actor, body: UserModel["updateMe"], locale: Locale = env.DEFAULT_LOCALE) {
		const patch: { name?: string; image?: string | null; updatedAt: Date } = {
			updatedAt: new Date(),
		}
		if (body.name !== undefined) patch.name = sanitizeText(body.name)
		if (body.image !== undefined) {
			patch.image = body.image === null ? null : sanitizeText(body.image, { collapseWhitespace: true })
		}

		if (patch.name !== undefined && patch.name.length === 0) {
			failT(locale, 422, "VALIDATION", "errors.nameEmpty")
		}

		const updated = await userRepository.update(actor.id, patch)
		if (!updated) failT(locale, 404, "NOT_FOUND", "errors.userNotFound")
		return toPublicUser(updated)
	}

	/**
	 * Server-mediated avatar upload (primary storage flow — works for local and S3).
	 * Multipart → `getStorage().put()` → persist `user.image` as the returned URL.
	 * Key is stable per user (`avatars/{userId}{ext}`) so re-uploads overwrite.
	 * Does not use client presign.
	 */
	static async updateAvatar(actor: Actor, file: File, locale: Locale = env.DEFAULT_LOCALE) {
		const contentType = (file.type || "").toLowerCase()
		if (!AVATAR_TYPES.has(contentType)) {
			failT(locale, 422, "VALIDATION", "errors.avatarInvalidType")
		}

		const ext = extensionFromFilename(file.name) || extensionFromContentType(contentType)
		const storage = getStorage()

		let put
		try {
			put = await storage.put({
				key: `avatars/${actor.id}${ext}`,
				body: file,
				filename: file.name,
				contentType,
			})
		} catch {
			failT(locale, 500, "INTERNAL", "errors.avatarUploadFailed")
		}

		const updated = await userRepository.update(actor.id, {
			image: put.url,
			updatedAt: new Date(),
		})
		if (!updated) failT(locale, 404, "NOT_FOUND", "errors.userNotFound")
		return toPublicUser(updated)
	}

	static async list(actor: Actor, query: UserModel["listQuery"], locale: Locale = env.DEFAULT_LOCALE) {
		if (!hasPermission(actor.role, { user: ["list"] })) {
			failT(locale, 403, "FORBIDDEN", "errors.cannotListUsers")
		}

		const limit = query.limit ?? 20
		const offset = query.offset ?? 0
		const { items, total } = await userRepository.list({ limit, offset })

		return paginated(items.map(toPublicUser), total, { limit, offset })
	}

	static async createUser(
		actor: Actor,
		body: UserModel["createUser"],
		headers: Headers,
		locale: Locale = env.DEFAULT_LOCALE,
	) {
		if (!hasPermission(actor.role, { user: ["create"] })) {
			failT(locale, 403, "FORBIDDEN", "errors.cannotCreateUsers")
		}

		const role = body.role ?? "user"
		if (!isRoleName(role)) failT(locale, 422, "VALIDATION", "errors.unknownRole")

		const result = await auth.api.createUser({
			body: {
				name: sanitizeText(body.name),
				email: body.email.trim().toLowerCase(),
				password: body.password,
				role,
			},
			headers,
		})

		if (!result?.user) failT(locale, 500, "INTERNAL", "errors.couldNotCreateUser")

		const row = await userRepository.findById(result.user.id)
		if (!row) failT(locale, 404, "NOT_FOUND", "errors.userNotFound")
		return toPublicUser(row)
	}

	static async setRole(
		actor: Actor,
		id: string,
		role: RoleName,
		headers: Headers,
		locale: Locale = env.DEFAULT_LOCALE,
	) {
		if (!hasPermission(actor.role, { user: ["set-role"] })) {
			failT(locale, 403, "FORBIDDEN", "errors.cannotChangeRoles")
		}
		if (!isRoleName(role)) failT(locale, 422, "VALIDATION", "errors.unknownRole")

		const current = await userRepository.findById(id)
		if (!current) failT(locale, 404, "NOT_FOUND", "errors.userNotFound")

		if (current.role === "admin" && role !== "admin") {
			const admins = await userRepository.countByRole("admin")
			if (admins <= 1) {
				failT(locale, 409, "CONFLICT", "errors.adminMustRemain")
			}
		}

		await auth.api.setRole({
			body: { userId: id, role },
			headers,
		})

		const updated = await userRepository.findById(id)
		if (!updated) failT(locale, 404, "NOT_FOUND", "errors.userNotFound")
		return toPublicUser(updated)
	}

	static async ban(
		actor: Actor,
		id: string,
		body: UserModel["banBody"],
		headers: Headers,
		locale: Locale = env.DEFAULT_LOCALE,
	) {
		if (!hasPermission(actor.role, { user: ["ban"] })) {
			failT(locale, 403, "FORBIDDEN", "errors.cannotBanUsers")
		}
		if (actor.id === id) failT(locale, 409, "CONFLICT", "errors.cannotBanSelf")

		const current = await userRepository.findById(id)
		if (!current) failT(locale, 404, "NOT_FOUND", "errors.userNotFound")

		await auth.api.banUser({
			body: {
				userId: id,
				banReason: body.reason,
				banExpiresIn: body.banExpiresIn,
			},
			headers,
		})

		const updated = await userRepository.findById(id)
		if (!updated) failT(locale, 404, "NOT_FOUND", "errors.userNotFound")
		return toPublicUser(updated)
	}

	static async unban(
		actor: Actor,
		id: string,
		headers: Headers,
		locale: Locale = env.DEFAULT_LOCALE,
	) {
		if (!hasPermission(actor.role, { user: ["ban"] })) {
			failT(locale, 403, "FORBIDDEN", "errors.cannotUnbanUsers")
		}

		const current = await userRepository.findById(id)
		if (!current) failT(locale, 404, "NOT_FOUND", "errors.userNotFound")

		await auth.api.unbanUser({
			body: { userId: id },
			headers,
		})

		const updated = await userRepository.findById(id)
		if (!updated) failT(locale, 404, "NOT_FOUND", "errors.userNotFound")
		return toPublicUser(updated)
	}

	static async remove(
		actor: Actor,
		id: string,
		headers: Headers,
		locale: Locale = env.DEFAULT_LOCALE,
	) {
		if (!hasPermission(actor.role, { user: ["delete"] })) {
			failT(locale, 403, "FORBIDDEN", "errors.cannotDeleteUsers")
		}
		if (actor.id === id) failT(locale, 409, "CONFLICT", "errors.cannotDeleteSelf")

		const current = await userRepository.findById(id)
		if (!current) failT(locale, 404, "NOT_FOUND", "errors.userNotFound")

		if (current.role === "admin") {
			const admins = await userRepository.countByRole("admin")
			if (admins <= 1) {
				failT(locale, 409, "CONFLICT", "errors.adminMustRemain")
			}
		}

		await auth.api.removeUser({
			body: { userId: id },
			headers,
		})

		return { id, deleted: true as const }
	}
}

function extensionFromContentType(contentType: string): string {
	switch (contentType) {
		case "image/png":
			return ".png"
		case "image/jpeg":
		case "image/jpg":
			return ".jpg"
		case "image/gif":
			return ".gif"
		case "image/webp":
			return ".webp"
		default:
			return ""
	}
}
