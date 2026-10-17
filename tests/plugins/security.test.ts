import { afterEach, describe, expect, it } from "bun:test"

import { env } from "../../src/env"
import { deriveRateLimitKey, rateLimiter, resolveClientKey } from "../../src/plugins/security"
import { request, signUp } from "../helpers/http"

describe("plugins.security", () => {
	afterEach(() => {
		rateLimiter.reset()
		delete process.env.RATE_LIMIT_ENABLED
	})

	it("honors x-test-ip only when NODE_ENV is test", () => {
		const req = new Request("http://localhost/health", {
			headers: { "x-test-ip": "203.0.113.9" },
		})
		expect(resolveClientKey(req, { trustProxy: false, nodeEnv: "test" })).toBe("203.0.113.9")
		expect(resolveClientKey(req, { trustProxy: false, nodeEnv: "development" })).toBe("local")
		expect(resolveClientKey(req, { trustProxy: false, nodeEnv: "production" })).toBe("local")
	})

	it("skips HTTP rate limiting when RATE_LIMIT_ENABLED is unset", async () => {
		delete process.env.RATE_LIMIT_ENABLED
		const ip = `disabled-${Date.now()}`
		for (let i = 0; i < env.RATE_LIMIT_MAX + 5; i++) {
			rateLimiter.check(`ip:${ip}`)
		}
		const res = await request("/", { headers: { "x-test-ip": ip } })
		expect(res.response.status).toBe(200)
		expect(res.response.headers.get("x-ratelimit-limit")).toBeNull()
	})

	it("keys unauthenticated requests by IP", async () => {
		process.env.RATE_LIMIT_ENABLED = "true"
		const ip = `unauth-${Date.now()}`
		expect(
			await deriveRateLimitKey(
				new Request("http://localhost/", { headers: { "x-test-ip": ip } }),
			),
		).toBe(`ip:${ip}`)

		for (let i = 0; i < env.RATE_LIMIT_MAX; i++) {
			expect(rateLimiter.check(`ip:${ip}`).allowed).toBe(true)
		}
		expect(rateLimiter.check(`ip:${ip}`).allowed).toBe(false)

		const limited = await request("/", {
			headers: { "x-test-ip": ip },
		})
		expect(limited.response.status).toBe(429)
		expect(limited.body.code).toBe("RATE_LIMITED")
		expect(limited.response.headers.get("retry-after")).toBeTruthy()

		const other = await request("/", {
			headers: { "x-test-ip": `${ip}-other` },
		})
		expect(other.response.status).toBe(200)
	})

	it("does not share rate-limit buckets across authenticated users on the same IP", async () => {
		process.env.RATE_LIMIT_ENABLED = "true"
		const stamp = Date.now()
		const ip = `nat-${stamp}`
		const userA = await signUp("NatA", `nat-a-${stamp}@example.com`)
		const userB = await signUp("NatB", `nat-b-${stamp}@example.com`)

		expect(
			await deriveRateLimitKey(
				new Request("http://localhost/", {
					headers: {
						"x-test-ip": ip,
						authorization: `Bearer ${userA.token}`,
					},
				}),
			),
		).toBe(`user:${userA.user.id}`)
		expect(
			await deriveRateLimitKey(
				new Request("http://localhost/", {
					headers: {
						"x-test-ip": ip,
						authorization: `Bearer ${userB.token}`,
					},
				}),
			),
		).toBe(`user:${userB.user.id}`)

		for (let i = 0; i < env.RATE_LIMIT_MAX; i++) {
			expect(rateLimiter.check(`user:${userA.user.id}`).allowed).toBe(true)
		}
		expect(rateLimiter.check(`user:${userA.user.id}`).allowed).toBe(false)

		const limitedA = await request("/", {
			headers: {
				"x-test-ip": ip,
				authorization: `Bearer ${userA.token}`,
			},
		})
		expect(limitedA.response.status).toBe(429)
		expect(limitedA.body.code).toBe("RATE_LIMITED")

		const okB = await request("/", {
			headers: {
				"x-test-ip": ip,
				authorization: `Bearer ${userB.token}`,
			},
		})
		expect(okB.response.status).toBe(200)

		// Same shared IP, no session → separate IP bucket, still allowed
		const okUnauth = await request("/", {
			headers: { "x-test-ip": ip },
		})
		expect(okUnauth.response.status).toBe(200)
	})
})
