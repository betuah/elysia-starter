import type { PgliteDatabase } from "drizzle-orm/pglite"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import type * as schema from "./schema"

/** Drizzle DB surface — postgres.js (runtime) or PGlite (tests). */
export type AppSqlDatabase =
	| PostgresJsDatabase<typeof schema>
	| PgliteDatabase<typeof schema>
