import { database } from "./index"

/**
 * Better Auth database adapter — Postgres only (`drizzleAdapter` + `provider: "pg"`).
 */
export async function createAuthDatabaseAdapter() {
	const { drizzleAdapter } = await import("better-auth/adapters/drizzle")
	const { authSchema } = await import("./schema")
	return drizzleAdapter(database, {
		provider: "pg",
		schema: authSchema,
	})
}
