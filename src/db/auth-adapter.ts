import { db } from "./index"

/**
 * Better Auth database adapter — Postgres only (`drizzleAdapter` + `provider: "pg"`).
 */
export async function createAuthDatabaseAdapter() {
	const { drizzleAdapter } = await import("better-auth/adapters/drizzle")
	const { authSchema } = await import("./schema")
	return drizzleAdapter(db, {
		provider: "pg",
		schema: authSchema,
	})
}
