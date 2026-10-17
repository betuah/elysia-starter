import { t, type UnwrapSchema } from "elysia"

import { roleNames } from "../../auth/permissions"
import { pageQuery, paginatedSchema } from "../../models/pagination"

/**
 * String fields on **response** schemas use `trusted: true` so Elysia `sanitize`
 * (Bun.escapeHTML) does not re-escape JSON for React clients.
 * Password / URL inputs also use `trusted` so credentials and query strings stay intact.
 */
const publicUser = t.Object({
	id: t.String({ trusted: true }),
	name: t.String({ trusted: true }),
	email: t.String({ trusted: true }),
	image: t.Union([t.String({ trusted: true }), t.Null()]),
	role: t.String({ trusted: true }),
	banned: t.Boolean(),
	emailVerified: t.Boolean(),
	createdAt: t.String({ format: "date-time", trusted: true }),
})

export const UserModel = {
	profile: publicUser,
	listQuery: pageQuery,
	list: paginatedSchema(publicUser),
	access: t.Object({
		role: t.String({ trusted: true }),
		permissions: t.Record(t.String({ trusted: true }), t.Array(t.String({ trusted: true }))),
	}),
	updateMe: t.Object({
		name: t.Optional(t.String({ minLength: 1, maxLength: 120 })),
		/** URL — skip HTML escape so `&` in query strings is preserved. */
		image: t.Optional(t.Union([t.String({ maxLength: 2048, trusted: true }), t.Null()])),
	}),
	/** Multipart avatar upload — field `file`. */
	avatarBody: t.Object({
		file: t.File({
			type: ["image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp"],
			maxSize: "2m",
		}),
	}),
	setRole: t.Object({
		role: t.Union(roleNames.map((role) => t.Literal(role))),
	}),
	createUser: t.Object({
		name: t.String({ minLength: 1, maxLength: 120 }),
		email: t.String({ format: "email", maxLength: 255 }),
		/** Never HTML-escape credentials (`&` → `&amp;` would corrupt passwords). */
		password: t.String({ minLength: 8, maxLength: 128, trusted: true }),
		role: t.Optional(t.Union(roleNames.map((role) => t.Literal(role)))),
	}),
	banBody: t.Object({
		reason: t.Optional(t.String({ maxLength: 500 })),
		/** Ban duration in seconds. Omit for permanent. */
		banExpiresIn: t.Optional(t.Numeric({ minimum: 1 })),
	}),
	idParams: t.Object({
		id: t.String({ minLength: 1, trusted: true }),
	}),
	deleted: t.Object({
		id: t.String({ trusted: true }),
		deleted: t.Literal(true),
	}),
} as const

export type UserModel = {
	[Key in keyof typeof UserModel]: UnwrapSchema<(typeof UserModel)[Key]>
}
