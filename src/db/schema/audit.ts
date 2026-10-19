import { index, jsonb, pgTable, text } from "drizzle-orm/pg-core"

import { user } from "./auth"
import { timestampColumn } from "./columns"

/**
 * Business-event audit trail (activity log).
 * Not an HTTP access log — request access is console-only (see `plugins/access-log`).
 */
export const auditLog = pgTable(
	"audit_log",
	{
		id: text("id").primaryKey(),
		/** Null when the actor was anonymous or the user was later deleted. */
		actorUserId: text("actor_user_id").references(() => user.id, { onDelete: "set null" }),
		action: text("action").notNull(),
		resourceType: text("resource_type"),
		resourceId: text("resource_id"),
		metadata: jsonb("metadata").$type<Record<string, unknown>>(),
		ip: text("ip"),
		userAgent: text("user_agent"),
		createdAt: timestampColumn("created_at"),
	},
	(table) => [
		index("audit_log_actor_user_id_idx").on(table.actorUserId),
		index("audit_log_action_idx").on(table.action),
		index("audit_log_created_at_idx").on(table.createdAt),
	],
)
