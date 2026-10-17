import { join } from "node:path"

import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js"
import { migrate as migratePostgres } from "drizzle-orm/postgres-js/migrator"
import postgres from "postgres"

import { env } from "../env"
import * as schema from "./schema"

/**
 * Apply Drizzle migrations once (e.g. cluster primary before fork).
 * Opens a short-lived connection and closes it so workers do not share it.
 *
 * Skipped when USE_PGLITE / NODE_ENV=test — PGlite migrates on open in the worker.
 */
export async function runBootMigrations(): Promise<void> {
	if (env.USE_PGLITE) {
		console.log("[db] USE_PGLITE — skipping standalone boot migrations (applied on open).")
		return
	}

	if (!env.DATABASE_URL) {
		throw new Error("DATABASE_URL is required.")
	}

	const client = postgres(env.DATABASE_URL, { max: 1 })
	try {
		const db = drizzlePostgres(client, { schema })
		await migratePostgres(db, {
			migrationsFolder: join(import.meta.dir, "../../drizzle"),
		})
	} finally {
		await client.end({ timeout: 5 })
	}
}
