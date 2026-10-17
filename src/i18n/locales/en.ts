/** English message catalog — nested keys flattened via `t()`. */
export const en = {
	"locales.en": "English",
	"locales.id": "Bahasa Indonesia",

	"errors.unauthorized": "Authentication required",
	"errors.forbidden": "You do not have permission to perform this action",
	"errors.notFound": "Not found",
	"errors.validation": "Request validation failed",
	"errors.parse": "Request body could not be parsed",
	"errors.rateLimited": "Too many requests",
	"errors.banned": "This account is banned",
	"errors.internal": "Internal server error",
	"errors.routeNotFound": "Route not found",

	"errors.userNotFound": "User not found",
	"errors.nameEmpty": "Name cannot be empty",
	"errors.cannotListUsers": "You cannot list users",
	"errors.cannotCreateUsers": "You cannot create users",
	"errors.unknownRole": "Unknown role",
	"errors.couldNotCreateUser": "Could not create user",
	"errors.cannotChangeRoles": "You cannot change roles",
	"errors.adminMustRemain": "At least one administrator must remain",
	"errors.cannotBanUsers": "You cannot ban users",
	"errors.cannotBanSelf": "You cannot ban yourself",
	"errors.cannotUnbanUsers": "You cannot unban users",
	"errors.cannotDeleteUsers": "You cannot delete users",
	"errors.cannotDeleteSelf": "You cannot delete yourself",
	"errors.cannotViewUser": "You cannot view this user",
	"errors.ownDataOnly": "You can only access your own data",
	"errors.fileNotFound": "File not found",
	"errors.fileInvalidKey": "Invalid file key",
	"errors.fileUploadFailed": "File upload failed",
	"errors.avatarInvalidType": "Avatar must be an image (png, jpeg, gif, or webp)",
	"errors.avatarUploadFailed": "Avatar upload failed",

	"health.ok": "ok",
} as const

export type MessageKey = keyof typeof en
