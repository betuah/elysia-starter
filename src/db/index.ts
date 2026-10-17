import { env } from "../env"
import type { AppSqlDatabase } from "./types"

async function createDatabase(): Promise<AppSqlDatabase> {
	if (env.USE_PGLITE) {
		const { openPglite } = await import("./providers/pglite")
		return openPglite()
	}

	const { openPostgres } = await import("./providers/postgres")
	return openPostgres()
}

/**
 * Drizzle client — Postgres (postgres.js) or in-memory PGlite in tests.
 * Domain repositories live in modules (e.g. `src/modules/user/repository.ts`), not here.
 */
export const db: AppSqlDatabase = await createDatabase()

export type { AppSqlDatabase } from "./types"
