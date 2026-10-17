import { afterEach, describe, expect, it } from "bun:test"

import { env } from "../../src/env"
import { rateLimiter, resolveClientKey } from "../../src/plugins/security"
import { request } from "../helpers/http"

describe("plugins.security", () => {
	afterEach(() => {
		rateLimiter.reset()
	})

	it("honors x-test-ip only when NODE_ENV is test", () => {
		const req = new Request("http://localhost/health", {
			headers: { "x-test-ip": "203.0.113.9" },
		})
		expect(resolveClientKey(req, { trustProxy: false, nodeEnv: "test" })).toBe("203.0.113.9")
		expect(resolveClientKey(req, { trustProxy: false, nodeEnv: "development" })).toBe("local")
		expect(resolveClientKey(req, { trustProxy: false, nodeEnv: "production" })).toBe("local")
	})

	it("returns 429 when the in-memory limiter is exhausted", async () => {
		const ip = `rl-${Date.now()}`
		for (let i = 0; i < env.RATE_LIMIT_MAX; i++) {
			expect(rateLimiter.check(ip).allowed).toBe(true)
		}
		expect(rateLimiter.check(ip).allowed).toBe(false)

		const limited = await request("/", {
			headers: { "x-test-ip": ip },
		})
		expect(limited.response.status).toBe(429)
		expect(limited.body.code).toBe("RATE_LIMITED")
		expect(limited.response.headers.get("retry-after")).toBeTruthy()
	})
})
