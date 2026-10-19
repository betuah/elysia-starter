import { t, type UnwrapSchema } from "elysia"

import { paginatedDataSchema } from "../../models/pagination"
import { successSchema } from "../../models/success"

const auditEntry = t.Object({
	id: t.String({ trusted: true }),
	actorUserId: t.Union([t.String({ trusted: true }), t.Null()]),
	action: t.String({ trusted: true }),
	resourceType: t.Union([t.String({ trusted: true }), t.Null()]),
	resourceId: t.Union([t.String({ trusted: true }), t.Null()]),
	metadata: t.Union([t.Record(t.String({ trusted: true }), t.Any()), t.Null()]),
	ip: t.Union([t.String({ trusted: true }), t.Null()]),
	userAgent: t.Union([t.String({ trusted: true }), t.Null()]),
	createdAt: t.String({ format: "date-time", trusted: true }),
})

export const AuditModel = {
	entry: auditEntry,
	listQuery: t.Object({
		page: t.Optional(t.Numeric({ minimum: 1, default: 1 })),
		pageSize: t.Optional(t.Numeric({ minimum: 1, maximum: 100, default: 20 })),
		userId: t.Optional(t.String({ minLength: 1, trusted: true })),
		action: t.Optional(t.String({ minLength: 1, maxLength: 120, trusted: true })),
		from: t.Optional(t.String({ format: "date-time", trusted: true })),
		to: t.Optional(t.String({ format: "date-time", trusted: true })),
	}),
	list: successSchema(paginatedDataSchema(auditEntry)),
} as const

export type AuditModel = {
	[Key in keyof typeof AuditModel]: UnwrapSchema<(typeof AuditModel)[Key]>
}
