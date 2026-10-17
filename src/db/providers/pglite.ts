import { join } from "node:path"

import { PGlite } from "@electric-sql/pglite"
import { drizzle } from "drizzle-orm/pglite"
import { migrate } from "drizzle-orm/pglite/migrator"

import { env } from "../../env"
import * as schema from "../schema"

/**
 * In-memory Postgres via PGlite — used by `bun test` (see tests/preload.ts).
 * Same Drizzle schema + migrations as production postgres.js.
 */
export async function openPglite() {
	const client = new PGlite()
	const db = drizzle(client, { schema })
	if (env.RUN_MIGRATIONS) {
		await migrate(db, { migrationsFolder: join(import.meta.dir, "../../../drizzle") })
	}
	return db
}
