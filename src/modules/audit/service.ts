import { hasPermission } from "../../auth/permissions"
import { env } from "../../env"
import type { Locale } from "../../i18n"
import { t } from "../../i18n"
import type { Actor } from "../../lib/actor"
import { failT } from "../../lib/error"
import { paginatedPage, toLimitOffset } from "../../lib/response"
import type { AuditModel } from "./model"
import { auditRepository, type AuditLogRecord } from "./repository"

function successMessage(locale: Locale) {
	return t(locale, "common.success")
}

function toPublicEntry(row: AuditLogRecord) {
	return {
		id: row.id,
		actorUserId: row.actorUserId,
		action: row.action,
		resourceType: row.resourceType,
		resourceId: row.resourceId,
		metadata: row.metadata,
		ip: row.ip,
		userAgent: row.userAgent,
		createdAt: row.createdAt.toISOString(),
	}
}

function parseOptionalDate(value: string | undefined, locale: Locale, field: string): Date | undefined {
	if (value === undefined) return undefined
	const date = new Date(value)
	if (Number.isNaN(date.getTime())) {
		failT(locale, 422, "VALIDATION", "errors.invalidDate", { field })
	}
	return date
}

export abstract class AuditService {
	static async list(
		actor: Actor,
		query: AuditModel["listQuery"],
		locale: Locale = env.DEFAULT_LOCALE,
	) {
		if (!hasPermission(actor.role, { audit: ["list"] })) {
			failT(locale, 403, "FORBIDDEN", "errors.forbidden")
		}

		const page = query.page ?? 1
		const pageSize = query.pageSize ?? 20
		const { limit, offset } = toLimitOffset({ page, pageSize })

		const from = parseOptionalDate(query.from, locale, "from")
		const to = parseOptionalDate(query.to, locale, "to")
		if (from && to && from > to) {
			failT(locale, 422, "VALIDATION", "errors.invalidDateRange")
		}

		const { items, total } = await auditRepository.list({
			limit,
			offset,
			...(query.userId !== undefined ? { userId: query.userId } : {}),
			...(query.action !== undefined ? { action: query.action } : {}),
			...(from !== undefined ? { from } : {}),
			...(to !== undefined ? { to } : {}),
		})

		return paginatedPage(items.map(toPublicEntry), total, { page, pageSize }, {
			message: successMessage(locale),
		})
	}
}
