import { describe, expect, it } from "bun:test"

import { hasPermission, roleNames } from "../../src/auth/permissions"
import { createRateLimiter } from "../../src/plugins/rate-limit"

describe("auth.permissions", () => {
	it("exposes only user and admin roles", () => {
		expect(roleNames).toEqual(["user", "admin"])
	})

	it("keeps user administration off the member role", () => {
		expect(hasPermission("user", { user: ["list"] })).toBe(false)
		expect(hasPermission("user", { user: ["set-role"] })).toBe(false)
		expect(hasPermission("user", { user: ["ban"] })).toBe(false)
		expect(hasPermission("user", { user: ["delete"] })).toBe(false)
	})

	it("lets an admin manage users and sessions", () => {
		expect(hasPermission("admin", { user: ["list"] })).toBe(true)
		expect(hasPermission("admin", { user: ["set-role"] })).toBe(true)
		expect(hasPermission("admin", { user: ["ban"] })).toBe(true)
		expect(hasPermission("admin", { user: ["delete"] })).toBe(true)
		expect(hasPermission("admin", { session: ["revoke"] })).toBe(true)
	})

	it("denies an unknown role", () => {
		expect(hasPermission("editor", { user: ["list"] })).toBe(false)
		expect(hasPermission("owner", { user: ["list"] })).toBe(false)
	})
})

describe("rate limiter", () => {
	it("blocks the request after the window is exhausted", () => {
		const limiter = createRateLimiter({ windowMs: 1_000, max: 2 })
		expect(limiter.check("client", 0).allowed).toBe(true)
		expect(limiter.check("client", 10).allowed).toBe(true)
		expect(limiter.check("client", 20).allowed).toBe(false)
		expect(limiter.check("client", 1_001).allowed).toBe(true)
	})
})
