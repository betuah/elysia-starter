import { relations } from "drizzle-orm"

import { auditLog } from "./audit"
import { account, session, user } from "./auth"

export const userRelations = relations(user, ({ many }) => ({
	sessions: many(session),
	accounts: many(account),
	auditLogs: many(auditLog),
}))

export const sessionRelations = relations(session, ({ one }) => ({
	user: one(user, { fields: [session.userId], references: [user.id] }),
}))

export const accountRelations = relations(account, ({ one }) => ({
	user: one(user, { fields: [account.userId], references: [user.id] }),
}))

export const auditLogRelations = relations(auditLog, ({ one }) => ({
	actor: one(user, { fields: [auditLog.actorUserId], references: [user.id] }),
}))
