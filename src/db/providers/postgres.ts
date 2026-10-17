import { join } from "node:path"

import { drizzle } from "drizzle-orm/postgres-js"
import { migrate } from "drizzle-orm/postgres-js/migrator"
import postgres from "postgres"

import { env } from "../../env"
import * as schema from "../schema"

export async function openPostgres() {
	const client = postgres(env.DATABASE_URL, { max: 10 })
	const db = drizzle(client, { schema })
	if (env.RUN_MIGRATIONS) {
		await migrate(db, { migrationsFolder: join(import.meta.dir, "../../../drizzle") })
	}
	return db
}
