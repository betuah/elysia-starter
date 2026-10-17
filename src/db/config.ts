/**
 * Pure DATABASE_* parsing — safe to unit-test without opening a connection
 * or loading BETTER_AUTH_SECRET.
 */

export type DatabaseConnection = {
	/** Postgres connection string (required unless USE_PGLITE / NODE_ENV=test). */
	url: string
	/**
	 * In-memory PGlite instead of postgres.js.
	 * Default on when `NODE_ENV=test` so `bun test` stays hermetic.
	 */
	usePglite: boolean
}

export type DatabaseEnvInput = {
	NODE_ENV?: string | undefined
	DATABASE_URL?: string | undefined
	USE_PGLITE?: string | undefined
}

function flag(value: string | undefined): boolean {
	return value === "true" || value === "1"
}

/**
 * Resolve Postgres connection settings.
 * Does not connect — validates required env for the chosen driver.
 */
export function resolveDatabaseConnection(
	envVars: DatabaseEnvInput = process.env as DatabaseEnvInput,
): DatabaseConnection {
	const usePglite =
		flag(envVars.USE_PGLITE) || envVars.NODE_ENV === "test"
	const url = envVars.DATABASE_URL?.trim() || ""

	if (!usePglite && !url) {
		throw new Error("DATABASE_URL is required (Postgres).")
	}

	return {
		url: url || "pglite://memory",
		usePglite,
	}
}
