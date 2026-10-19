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
		"user.Invite": UserModel.inviteUser,
		"user.Ban": UserModel.banBody,
		"user.IdParams": UserModel.idParams,
		"user.Deleted": UserModel.deleted,
	})
	// GET
	.get("/me", ({ user, locale }) => UserService.me(user, locale), {
		auth: true,
		response: { 200: "user.Profile", 404: "common.Error", ...guarded },
		detail: { summary: "GET Current user profile" },
	})
	.get("/me/access", ({ user, locale }) => UserService.access(user, locale), {
		auth: true,
		response: { 200: "user.Access", ...guarded },
		detail: { summary: "GET Current permission" },
	})
	.get("", ({ query, user, locale }) => UserService.list(user, query, locale), {
		permission: { user: ["list"] },
		query: "user.ListQuery",
		response: { 200: "user.List", ...guarded },
		detail: { summary: "GET List all users (Admin)" },
	})
	.get("/:id", ({ params, user, locale }) => UserService.getById(user, params.id, locale), {
		auth: true,
		params: "user.IdParams",
		response: { 200: "user.Profile", 404: "common.Error", ...guarded },
		detail: { summary: "GET User by id" },
	})
	// POST
	.post(
		"/me/avatar",
		({ user, body, request, locale }) =>
			UserService.updateAvatar(user, body.file, request.headers, locale),
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
				summary: "Update Photo Profile (Avatar)",
				description:
					"Server-mediated upload (primary path). Multipart field `file` " +
					"(png/jpeg/gif/webp, max 2 MiB) → `getStorage().put()` → local disk or S3 " +
					"(no client presign). Sets `user.image` to the returned URL.",
			},
		},
	)
	.post(
		"",
		({ body, user, request, locale }) => UserService.createUser(user, body, request.headers, locale),
		{
			permission: { user: ["create"] },
			body: "user.Create",
			response: {
				200: "user.Profile",
				409: "common.Error",
				422: "common.Error",
				500: "common.Error",
				...guarded,
			},
			detail: {
				summary: "Create user with password (Admin)",
				description:
					"Direct create via Better Auth admin `createUser` (email + password). " +
					"Set `autoConfirm: true` to mark `emailVerified` so verification is not required. " +
					"For invite-without-password use `POST /api/users/invite`.",
			},
		},
	)
	.post(
		"/invite",
		({ body, user, request, locale }) =>
			UserService.inviteUser(user, body, request.headers, locale),
		{
			permission: { user: ["create"] },
			body: "user.Invite",
			response: {
				200: "user.Profile",
				409: "common.Error",
				422: "common.Error",
				500: "common.Error",
				...guarded,
			},
			detail: {
				summary: "Invite user by email (Admin)",
				description:
					"Creates a user without a password and emails a set-password link " +
					"(Better Auth reset-password token + React Email invite template). " +
					"Frontend route: `{APP_URL}/reset-password` — after the email link, " +
					"Better Auth redirects with `?token=` (or `?error=INVALID_TOKEN`); " +
					"complete with `POST /api/auth/reset-password` `{ token, newPassword }`. " +
					"Ensure `APP_URL` origin is in `TRUSTED_ORIGINS`. Permission: `user:create`.",
			},
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
			detail: { summary: "Ban a user (Admin)" },
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
			detail: { summary: "Unban a user (Admin)" },
		},
	)
	// PATCH
	.patch(
		"/me",
		({ user, body, request, locale }) =>
			UserService.updateMe(user, body, request.headers, locale),
		{
			auth: true,
			body: "user.UpdateMe",
			response: {
				200: "user.Profile",
				404: "common.Error",
				422: "common.Error",
				...guarded,
			},
			detail: { summary: "Update Profile" },
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
			detail: { summary: "Update or Change a User Role" },
		},
	)
	// DELETE
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
			detail: { summary: "Delete a user (Admin)" },
		},
	)
