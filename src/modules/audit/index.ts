import { Elysia } from "elysia"

import { sharedModels } from "../../models"
import { authPlugin } from "../../plugins/auth"
import { i18nPlugin } from "../../plugins/i18n"
import { AuditModel } from "./model"
import { AuditService } from "./service"

const guarded = {
	401: "common.Error",
	403: "common.Error",
	429: "common.Error",
} as const

/**
 * Activity / audit log API.
 * Lists business events from `audit_log` (not HTTP access lines).
 */
export const audit = new Elysia({
	name: "module.audit",
	prefix: "/api/audit",
	tags: ["Audit"],
	detail: {
		security: [{ bearerAuth: [] }],
		description:
			"Activity log of business events (profile changes, admin user actions, sign-in sessions). " +
			"Requires `audit:list`. HTTP request access logging is console-only (`plugins/access-log`).",
	},
})
	.use(sharedModels)
	.use(i18nPlugin)
	.use(authPlugin)
	.model({
		"audit.ListQuery": AuditModel.listQuery,
		"audit.List": AuditModel.list,
	})
	.get("", ({ query, user, locale }) => AuditService.list(user, query, locale), {
		permission: { audit: ["list"] },
		query: "audit.ListQuery",
		response: {
			200: "audit.List",
			422: "common.Error",
			...guarded,
		},
		detail: {
			summary: "GET List activity / audit events (Admin)",
			description:
				"Paginated activity log. Optional filters: `userId` (actor), `action`, `from`, `to` (ISO date-time).",
		},
	})
