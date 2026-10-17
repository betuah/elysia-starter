import { boolean, index, pgTable, text, timestamp } from "drizzle-orm/pg-core"

import { timestampColumn } from "./columns"

// Auth domain (Better Auth). Add related tables, such as user details, in this file.

export const user = pgTable("user", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	email: text("email").notNull().unique(),
	emailVerified: boolean("email_verified").default(false).notNull(),
	image: text("image"),
	role: text("role").default("user").notNull(),
	banned: boolean("banned").default(false).notNull(),
	banReason: text("ban_reason"),
	banExpires: timestamp("ban_expires", { mode: "date" }),
	createdAt: timestampColumn("created_at"),
	updatedAt: timestampColumn("updated_at").$onUpdate(() => new Date()),
})

export const session = pgTable(
	"session",
	{
		id: text("id").primaryKey(),
		expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
		token: text("token").notNull().unique(),
		ipAddress: text("ip_address"),
		userAgent: text("user_agent"),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		impersonatedBy: text("impersonated_by"),
		createdAt: timestampColumn("created_at"),
		updatedAt: timestampColumn("updated_at").$onUpdate(() => new Date()),
	},
	(table) => [index("session_userId_idx").on(table.userId)],
)

export const account = pgTable(
	"account",
	{
		id: text("id").primaryKey(),
		accountId: text("account_id").notNull(),
		providerId: text("provider_id").notNull(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		accessToken: text("access_token"),
		refreshToken: text("refresh_token"),
		idToken: text("id_token"),
		accessTokenExpiresAt: timestamp("access_token_expires_at", { mode: "date" }),
		refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { mode: "date" }),
		scope: text("scope"),
		password: text("password"),
		createdAt: timestampColumn("created_at"),
		updatedAt: timestampColumn("updated_at").$onUpdate(() => new Date()),
	},
	(table) => [index("account_userId_idx").on(table.userId)],
)

export const verification = pgTable(
	"verification",
	{
		id: text("id").primaryKey(),
		identifier: text("identifier").notNull(),
		value: text("value").notNull(),
		expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
		createdAt: timestampColumn("created_at"),
		updatedAt: timestampColumn("updated_at").$onUpdate(() => new Date()),
	},
	(table) => [index("verification_identifier_idx").on(table.identifier)],
)

/**
 * Better Auth `@better-auth/sso` provider registry.
 * Column names match plugin defaults (camelCase). Config blobs are JSON strings.
 * @see https://better-auth.com/docs/plugins/sso#schema
 */
export const ssoProvider = pgTable("ssoProvider", {
	id: text("id").primaryKey(),
	issuer: text("issuer").notNull(),
	oidcConfig: text("oidcConfig"),
	samlConfig: text("samlConfig"),
	userId: text("userId").references(() => user.id, { onDelete: "cascade" }),
	providerId: text("providerId").notNull().unique(),
	organizationId: text("organizationId"),
	domain: text("domain").notNull(),
})
