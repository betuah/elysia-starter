import { describe, expect, it } from "bun:test"

import { resolveDatabaseConnection } from "../../src/db/config"

describe("db.config", () => {
	it("requires DATABASE_URL unless PGlite / test", () => {
		expect(() =>
			resolveDatabaseConnection({ NODE_ENV: "development", DATABASE_URL: "" }),
		).toThrow(/DATABASE_URL is required/)

		const ok = resolveDatabaseConnection({
			NODE_ENV: "development",
			DATABASE_URL: "postgresql://localhost/app",
		})
		expect(ok.url).toBe("postgresql://localhost/app")
		expect(ok.usePglite).toBe(false)
	})

	it("enables PGlite when NODE_ENV=test", () => {
		const cfg = resolveDatabaseConnection({ NODE_ENV: "test" })
		expect(cfg.usePglite).toBe(true)
		expect(cfg.url).toBe("pglite://memory")
	})

	it("enables PGlite when USE_PGLITE=true", () => {
		const cfg = resolveDatabaseConnection({
			NODE_ENV: "development",
			USE_PGLITE: "true",
		})
		expect(cfg.usePglite).toBe(true)
	})
})
