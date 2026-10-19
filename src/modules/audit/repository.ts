import { and, count, desc, eq, gte, lte, type SQL } from "drizzle-orm"

import { db } from "../../db"
import { auditLog } from "../../db/schema"

export type AuditLogRecord = {
	id: string
	actorUserId: string | null
	action: string
	resourceType: string | null
	resourceId: string | null
	metadata: Record<string, unknown> | null
	ip: string | null
	userAgent: string | null
	createdAt: Date
}

export type AuditListFilters = {
	limit: number
	offset: number
	userId?: string
	action?: string
	from?: Date
	to?: Date
}

export type AuditListResult = {
	items: AuditLogRecord[]
	total: number
}

function toRecord(row: typeof auditLog.$inferSelect): AuditLogRecord {
	return {
		id: row.id,
		actorUserId: row.actorUserId ?? null,
		action: row.action,
		resourceType: row.resourceType ?? null,
		resourceId: row.resourceId ?? null,
		metadata: (row.metadata as Record<string, unknown> | null) ?? null,
		ip: row.ip ?? null,
		userAgent: row.userAgent ?? null,
		createdAt: row.createdAt,
	}
}

function buildWhere(filters: AuditListFilters): SQL | undefined {
	const parts: SQL[] = []
	if (filters.userId) parts.push(eq(auditLog.actorUserId, filters.userId))
	if (filters.action) parts.push(eq(auditLog.action, filters.action))
	if (filters.from) parts.push(gte(auditLog.createdAt, filters.from))
	if (filters.to) parts.push(lte(auditLog.createdAt, filters.to))
	if (parts.length === 0) return undefined
	if (parts.length === 1) return parts[0]
	return and(...parts)
}

export const auditRepository = {
	async list(filters: AuditListFilters): Promise<AuditListResult> {
		const where = buildWhere(filters)
		const [items, totalRow] = await Promise.all([
			db
				.select()
				.from(auditLog)
				.where(where)
				.orderBy(desc(auditLog.createdAt))
				.limit(filters.limit)
				.offset(filters.offset),
			db.select({ total: count() }).from(auditLog).where(where),
		])
		return {
			items: items.map(toRecord),
			total: totalRow[0]?.total ?? 0,
		}
	},
}
