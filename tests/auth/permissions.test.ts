import { describe, expect, it } from "bun:test"

import { hasPermission, permissionsFor, roleNames } from "../../src/auth/permissions"
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

	it("ORs comma-separated roles for hasPermission and permissionsFor", () => {
		expect(hasPermission("user,admin", { user: ["ban"] })).toBe(true)
		const merged = permissionsFor("user,admin")
		expect(merged.user).toContain("ban")
		expect(merged.user).toContain("list")
		expect(merged.session).toContain("revoke")
		expect(permissionsFor("user").user).toBeUndefined()
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

	it("evicts expired keys so the map does not grow forever", () => {
		const limiter = createRateLimiter({ windowMs: 100, max: 5 })
		limiter.check("a", 0)
		limiter.check("b", 0)
		expect(limiter.size()).toBe(2)
		limiter.sweep(101)
		expect(limiter.size()).toBe(0)
	})
})
