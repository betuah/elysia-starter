import { count, eq } from "drizzle-orm"

import { db } from "../../db"
import { user } from "../../db/schema"

/** User row used by UserService / seed. */
export type UserRecord = {
	id: string
	name: string
	email: string
	image: string | null
	role: string
	banned: boolean
	emailVerified: boolean
	createdAt: Date
	updatedAt: Date
	banReason: string | null
	banExpires: Date | null
}

export type UserPatch = {
	name?: string
	image?: string | null
	role?: string
	emailVerified?: boolean
	updatedAt?: Date
}

export type UserListResult = {
	items: UserRecord[]
	total: number
}

export type UserRepository = {
	findById(id: string): Promise<UserRecord | null>
	findByEmail(email: string): Promise<UserRecord | null>
	list(options: { limit: number; offset: number }): Promise<UserListResult>
	countByRole(role: string): Promise<number>
	update(id: string, patch: UserPatch): Promise<UserRecord | null>
}

function toRecord(row: {
	id: string
	name: string
	email: string
	image: string | null
	role: string
	banned: boolean | null
	emailVerified: boolean
	createdAt: Date
	updatedAt: Date
	banReason: string | null
	banExpires: Date | null
}): UserRecord {
	return {
		id: row.id,
		name: row.name,
		email: row.email,
		image: row.image ?? null,
		role: row.role,
		banned: row.banned ?? false,
		emailVerified: row.emailVerified,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
		banReason: row.banReason ?? null,
		banExpires: row.banExpires ?? null,
	}
}

/**
 * User data access — lives with the user module (not under `src/db/`).
 * `src/db/` is infrastructure only: client, schema, migrate.
 */
export const userRepository: UserRepository = {
	async findById(id) {
		const row = await db.query.user.findFirst({ where: eq(user.id, id) })
		return row ? toRecord(row) : null
	},

	async findByEmail(email) {
		const row = await db.query.user.findFirst({ where: eq(user.email, email) })
		return row ? toRecord(row) : null
	},

	async list({ limit, offset }) {
		const [items, totalRow] = await Promise.all([
			db.select().from(user).limit(limit).offset(offset),
			db.select({ total: count() }).from(user),
		])
		return {
			items: items.map(toRecord),
			total: totalRow[0]?.total ?? 0,
		}
	},

	async countByRole(role) {
		const rows = await db.select({ id: user.id }).from(user).where(eq(user.role, role))
		return rows.length
	},

	async update(id, patch: UserPatch) {
		const set: {
			name?: string
			image?: string | null
			role?: string
			emailVerified?: boolean
			updatedAt: Date
		} = {
			updatedAt: patch.updatedAt ?? new Date(),
		}
		if (patch.name !== undefined) set.name = patch.name
		if (patch.image !== undefined) set.image = patch.image
		if (patch.role !== undefined) set.role = patch.role
		if (patch.emailVerified !== undefined) set.emailVerified = patch.emailVerified

		await db.update(user).set(set).where(eq(user.id, id))
		const row = await db.query.user.findFirst({ where: eq(user.id, id) })
		return row ? toRecord(row) : null
	},
}
