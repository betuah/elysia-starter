import { Elysia } from "elysia"

import { sharedModels } from "../../models"
import { authPlugin } from "../../plugins/auth"
import { i18nPlugin } from "../../plugins/i18n"
import { UserModel } from "./model"
import { UserService } from "./service"

const guarded = {
	401: "common.Error",
	403: "common.Error",
	429: "common.Error",
} as const

export const users = new Elysia({
	name: "module.users",
	prefix: "/api/users",
	tags: ["Users"],
	detail: {
		security: [{ bearerAuth: [] }],
		description:
			"Profile and admin user management. Regular users may only read/update their own profile. Admin actions also exist under Better Auth `/api/auth/admin/*` (see /api/auth/reference).",
	},
})
	.use(sharedModels)
	.use(i18nPlugin)
	.use(authPlugin)
	.model({
		"user.Profile": UserModel.profile,
		"user.ListQuery": UserModel.listQuery,
		"user.List": UserModel.list,
		"user.Access": UserModel.access,
		"user.UpdateMe": UserModel.updateMe,
		"user.AvatarBody": UserModel.avatarBody,
		"user.SetRole": UserModel.setRole,
		"user.Create": UserModel.createUser,
		"user.Ban": UserModel.banBody,
		"user.IdParams": UserModel.idParams,
		"user.Deleted": UserModel.deleted,
	})
	.get("/me", ({ user, locale }) => UserService.me(user, locale), {
		auth: true,
		response: { 200: "user.Profile", 404: "common.Error", ...guarded },
		detail: { summary: "Current user profile" },
	})
	.patch("/me", ({ user, body, locale }) => UserService.updateMe(user, body, locale), {
		auth: true,
		body: "user.UpdateMe",
		response: {
			200: "user.Profile",
			404: "common.Error",
			422: "common.Error",
			...guarded,
		},
		detail: { summary: "Update own profile (name, image URL)" },
	})
	.post(
		"/me/avatar",
		({ user, body, locale }) => UserService.updateAvatar(user, body.file, locale),
		{
			auth: true,
			body: "user.AvatarBody",
			response: {
				200: "user.Profile",
				404: "common.Error",
				422: "common.Error",
				500: "common.Error",
				...guarded,
			},
			detail: {
				summary: "Upload own avatar",
				description:
					"Server-mediated upload (primary path). Multipart field `file` " +
					"(png/jpeg/gif/webp, max 2 MiB) → `getStorage().put()` → local disk or S3 " +
					"(no client presign). Sets `user.image` to the returned URL.",
			},
		},
	)
	.get("/me/access", ({ user, locale }) => UserService.access(user, locale), {
		auth: true,
		response: { 200: "user.Access", ...guarded },
		detail: { summary: "Permissions granted to the current role" },
	})
	.get("", ({ query, user, locale }) => UserService.list(user, query, locale), {
		permission: { user: ["list"] },
		query: "user.ListQuery",
		response: { 200: "user.List", ...guarded },
		detail: { summary: "List users (admin)" },
	})
	.post(
		"",
		({ body, user, request, locale }) => UserService.createUser(user, body, request.headers, locale),
		{
			permission: { user: ["create"] },
			body: "user.Create",
			response: {
				200: "user.Profile",
				422: "common.Error",
				500: "common.Error",
				...guarded,
			},
			detail: {
				summary: "Invite / create a user (admin)",
				description:
					"Uses Better Auth admin createUser. No invite email is sent unless you wire one; share credentials out of band or extend with sendEmail.",
			},
		},
	)
	.patch(
		"/:id/role",
		({ params, body, user, request, locale }) =>
			UserService.setRole(user, params.id, body.role, request.headers, locale),
		{
			permission: { user: ["set-role"] },
			params: "user.IdParams",
			body: "user.SetRole",
			response: {
				200: "user.Profile",
				404: "common.Error",
				409: "common.Error",
				422: "common.Error",
				...guarded,
			},
			detail: { summary: "Change a user's role (promote/demote admin)" },
		},
	)
	.post(
		"/:id/ban",
		({ params, body, user, request, locale }) =>
			UserService.ban(user, params.id, body, request.headers, locale),
		{
			permission: { user: ["ban"] },
			params: "user.IdParams",
			body: "user.Ban",
			response: {
				200: "user.Profile",
				404: "common.Error",
				409: "common.Error",
				...guarded,
			},
			detail: { summary: "Ban a user (admin)" },
		},
	)
	.post(
		"/:id/unban",
		({ params, user, request, locale }) =>
			UserService.unban(user, params.id, request.headers, locale),
		{
			permission: { user: ["ban"] },
			params: "user.IdParams",
			response: { 200: "user.Profile", 404: "common.Error", ...guarded },
			detail: { summary: "Unban a user (admin)" },
		},
	)
	.delete(
		"/:id",
		({ params, user, request, locale }) =>
			UserService.remove(user, params.id, request.headers, locale),
		{
			permission: { user: ["delete"] },
			params: "user.IdParams",
			response: {
				200: "user.Deleted",
				404: "common.Error",
				409: "common.Error",
				...guarded,
			},
			detail: { summary: "Delete a user (admin)" },
		},
	)
	.get("/:id", ({ params, user, locale }) => UserService.getById(user, params.id, locale), {
		auth: true,
		params: "user.IdParams",
		response: { 200: "user.Profile", 404: "common.Error", ...guarded },
		detail: { summary: "Get a user by id (own profile or admin)" },
	})
