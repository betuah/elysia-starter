import { generateId } from "@better-auth/core/utils/id"
import * as React from "react"

import { auth } from "../../auth"
import { hasPermission, isRoleName, permissionsFor, type RoleName } from "../../auth/permissions"
import UserInviteEmail from "../../emails/user-invite"
import { env } from "../../env"
import type { Locale } from "../../i18n"
import { t } from "../../i18n"
import type { Actor } from "../../lib/actor"
import { auditContextFromHeaders, recordAudit } from "../../lib/audit"
import { renderEmail, sendEmail } from "../../lib/email"
import { failT } from "../../lib/error"
import { assertOwnerOrPermission } from "../../lib/ownership"
import { ok, paginatedPage, toLimitOffset } from "../../lib/response"
import { sanitizeText } from "../../lib/sanitize"
import { extensionFromFilename } from "../../lib/storage/keys"
import { getStorage } from "../../lib/storage"
import type { UserModel } from "./model"
import { userRepository, type UserRecord } from "./repository"

const AVATAR_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp"])

/**
 * Frontend path for invite / set-password after Better Auth redirects with `?token=`.
 * Full URL: `{APP_URL}/reset-password` — APP_URL origin must be in TRUSTED_ORIGINS.
 */
export const INVITE_SET_PASSWORD_PATH = "/reset-password"

function displayNameFromEmail(email: string): string {
	const local = email.split("@")[0]?.trim()
	return local && local.length > 0 ? local : "User"
}

function resolveUserName(name: string | undefined, email: string): string {
	if (name !== undefined) {
		const cleaned = sanitizeText(name)
		if (cleaned.length === 0) return displayNameFromEmail(email)
		return cleaned
	}
	return displayNameFromEmail(email)
}

function isDuplicateUserError(error: unknown): boolean {
	if (!error || typeof error !== "object") return false
	const record = error as { body?: { code?: string }; message?: string; code?: string }
	const code = record.body?.code ?? record.code ?? ""
	const message = typeof record.message === "string" ? record.message : ""
	return (
		code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL" ||
		code === "USER_ALREADY_EXISTS" ||
		/already exists/i.test(message)
	)
}

/**
 * Issue a Better Auth reset-password verification token and email an invite link.
 * Same token format as `requestPasswordReset` — frontend completes via
 * `POST /api/auth/reset-password` with `{ token, newPassword }` after the
 * callback lands on `{APP_URL}/reset-password?token=…`.
 */
async function sendInviteSetPasswordEmail(input: {
	userId: string
	email: string
	name: string
	inviterName?: string
}) {
	const ctx = await auth.$context
	/** Align with Better Auth default (`resetPasswordTokenExpiresIn` ≈ 1 hour). */
	const expiresInSec = 60 * 60
	const token = generateId(24)
	await ctx.internalAdapter.createVerificationValue({
		value: input.userId,
		identifier: `reset-password:${token}`,
		expiresAt: new Date(Date.now() + expiresInSec * 1000),
	})

	const redirectTo = `${env.APP_URL.replace(/\/+$/, "")}${INVITE_SET_PASSWORD_PATH}`
	const url = `${ctx.baseURL}/reset-password/${token}?callbackURL=${encodeURIComponent(redirectTo)}`

	const html = await renderEmail(
		React.createElement(UserInviteEmail, {
			name: input.name,
			url,
			appName: env.APP_NAME,
			...(input.inviterName ? { inviterName: input.inviterName } : {}),
		}),
	)
	await sendEmail({
		to: input.email,
		subject: `You're invited to ${env.APP_NAME}`,
		html,
		text: `Hi ${input.name},\n\nYou have been invited to join ${env.APP_NAME}. Set your password: ${url}\n\nIf you were not expecting this, ignore this email.`,
	})
}

/**
 * Public user DTO — response “sanitize”: omit secrets (password/hash/token never included).
 * Not HTML escape; Elysia input `sanitize` + frontend rendering handle XSS.
 */
export function toPublicUser(row: UserRecord): UserModel["publicUser"] {
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

function successMessage(locale: Locale) {
	return t(locale, "common.success")
}

export abstract class UserService {
	static async me(actor: Actor, locale: Locale = env.DEFAULT_LOCALE) {
		return UserService.getById(actor, actor.id, locale)
	}

	static access(actor: Actor, locale: Locale = env.DEFAULT_LOCALE) {
		const permissions = permissionsFor(actor.role)
		return ok(
			{
				role: actor.role,
				permissions: Object.fromEntries(
					Object.entries(permissions).map(([resource, actions]) => [resource, [...actions]]),
				),
			},
			{ message: successMessage(locale) },
		)
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
		return ok(toPublicUser(row), { message: successMessage(locale) })
	}

	static async updateMe(
		actor: Actor,
		body: UserModel["updateMe"],
		headers: Headers,
		locale: Locale = env.DEFAULT_LOCALE,
	) {
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

		const fields = Object.keys(body).filter((key) => body[key as keyof typeof body] !== undefined)
		await recordAudit({
			actorUserId: actor.id,
			action: "user.profile.update",
			resourceType: "user",
			resourceId: actor.id,
			metadata: { fields },
			...auditContextFromHeaders(headers),
		})

		return ok(toPublicUser(updated), { message: successMessage(locale) })
	}

	/**
	 * Server-mediated avatar upload (primary storage flow — works for local and S3).
	 * Multipart → `getStorage().put()` → persist `user.image` as the returned URL.
	 * Key is stable per user (`avatars/{userId}{ext}`) so re-uploads overwrite.
	 * Does not use client presign.
	 */
	static async updateAvatar(
		actor: Actor,
		file: File,
		headers: Headers,
		locale: Locale = env.DEFAULT_LOCALE,
	) {
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

		await recordAudit({
			actorUserId: actor.id,
			action: "user.avatar.upload",
			resourceType: "user",
			resourceId: actor.id,
			metadata: { contentType, filename: file.name },
			...auditContextFromHeaders(headers),
		})

		return ok(toPublicUser(updated), { message: successMessage(locale) })
	}

	static async list(actor: Actor, query: UserModel["listQuery"], locale: Locale = env.DEFAULT_LOCALE) {
		if (!hasPermission(actor.role, { user: ["list"] })) {
			failT(locale, 403, "FORBIDDEN", "errors.cannotListUsers")
		}

		const page = query.page ?? 1
		const pageSize = query.pageSize ?? 20
		const { limit, offset } = toLimitOffset({ page, pageSize })
		const { items, total } = await userRepository.list({ limit, offset })

		return paginatedPage(items.map(toPublicUser), total, { page, pageSize }, {
			message: successMessage(locale),
		})
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

		const email = body.email.trim().toLowerCase()
		const autoConfirm = body.autoConfirm === true
		const name = resolveUserName(body.name, email)

		let result: Awaited<ReturnType<typeof auth.api.createUser>>
		try {
			result = await auth.api.createUser({
				body: {
					name,
					email,
					password: body.password,
					role,
					...(autoConfirm ? { data: { emailVerified: true } } : {}),
				},
				headers,
			})
		} catch (error) {
			if (isDuplicateUserError(error)) {
				failT(locale, 409, "CONFLICT", "errors.userAlreadyExists")
			}
			throw error
		}

		if (!result?.user) failT(locale, 500, "INTERNAL", "errors.couldNotCreateUser")

		const row = await userRepository.findById(result.user.id)
		if (!row) failT(locale, 404, "NOT_FOUND", "errors.userNotFound")

		await recordAudit({
			actorUserId: actor.id,
			action: "user.create",
			resourceType: "user",
			resourceId: row.id,
			metadata: { email: row.email, role: row.role, autoConfirm, method: "direct" },
			...auditContextFromHeaders(headers),
		})

		return ok(toPublicUser(row), { message: successMessage(locale) })
	}

	/**
	 * Invite a user (no admin-set password). Creates an account without credentials,
	 * then emails a Better Auth set-password link (same verification as password reset).
	 */
	static async inviteUser(
		actor: Actor,
		body: UserModel["inviteUser"],
		headers: Headers,
		locale: Locale = env.DEFAULT_LOCALE,
	) {
		if (!hasPermission(actor.role, { user: ["create"] })) {
			failT(locale, 403, "FORBIDDEN", "errors.cannotCreateUsers")
		}

		const role = body.role ?? "user"
		if (!isRoleName(role)) failT(locale, 422, "VALIDATION", "errors.unknownRole")

		const email = body.email.trim().toLowerCase()
		const name = resolveUserName(body.name, email)

		let result: Awaited<ReturnType<typeof auth.api.createUser>>
		try {
			result = await auth.api.createUser({
				body: {
					name,
					email,
					role,
					// No password — credential account is created when the invitee sets one
					// via Better Auth reset-password (`resetCredentialPassword`).
				},
				headers,
			})
		} catch (error) {
			if (isDuplicateUserError(error)) {
				failT(locale, 409, "CONFLICT", "errors.userAlreadyExists")
			}
			throw error
		}

		if (!result?.user) failT(locale, 500, "INTERNAL", "errors.couldNotInviteUser")

		const row = await userRepository.findById(result.user.id)
		if (!row) failT(locale, 404, "NOT_FOUND", "errors.userNotFound")

		try {
			await sendInviteSetPasswordEmail({
				userId: row.id,
				email: row.email,
				name: row.name,
				inviterName: actor.name,
			})
		} catch {
			failT(locale, 500, "INTERNAL", "errors.couldNotInviteUser")
		}

		await recordAudit({
			actorUserId: actor.id,
			action: "user.invite",
			resourceType: "user",
			resourceId: row.id,
			metadata: {
				email: row.email,
				role: row.role,
				method: "invite",
				setPasswordPath: INVITE_SET_PASSWORD_PATH,
			},
			...auditContextFromHeaders(headers),
		})

		return ok(toPublicUser(row), { message: successMessage(locale) })
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

		const previousRole = current.role

		await auth.api.setRole({
			body: { userId: id, role },
			headers,
		})

		const updated = await userRepository.findById(id)
		if (!updated) failT(locale, 404, "NOT_FOUND", "errors.userNotFound")

		await recordAudit({
			actorUserId: actor.id,
			action: "user.set_role",
			resourceType: "user",
			resourceId: id,
			metadata: { from: previousRole, to: role },
			...auditContextFromHeaders(headers),
		})

		return ok(toPublicUser(updated), { message: successMessage(locale) })
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

		await recordAudit({
			actorUserId: actor.id,
			action: "user.ban",
			resourceType: "user",
			resourceId: id,
			metadata: {
				reason: body.reason ?? null,
				banExpiresIn: body.banExpiresIn ?? null,
			},
			...auditContextFromHeaders(headers),
		})

		return ok(toPublicUser(updated), { message: successMessage(locale) })
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

		await recordAudit({
			actorUserId: actor.id,
			action: "user.unban",
			resourceType: "user",
			resourceId: id,
			...auditContextFromHeaders(headers),
		})

		return ok(toPublicUser(updated), { message: successMessage(locale) })
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

		await recordAudit({
			actorUserId: actor.id,
			action: "user.delete",
			resourceType: "user",
			resourceId: id,
			metadata: { email: current.email, role: current.role },
			...auditContextFromHeaders(headers),
		})

		return ok({ id, deleted: true as const }, { message: successMessage(locale) })
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
