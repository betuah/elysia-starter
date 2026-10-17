import { describe, expect, it } from "bun:test"

import { assertOwnerOrPermission, isOwnerOrHasPermission } from "../../../src/lib/ownership"
import type { Actor } from "../../../src/lib/actor"

const member: Actor = {
	id: "u1",
	name: "Member",
	email: "m@example.com",
	role: "user",
	banned: false,
}

const admin: Actor = {
	id: "a1",
	name: "Admin",
	email: "a@example.com",
	role: "admin",
	banned: false,
}

describe("module.user ownership", () => {
	it("allows the owner without admin permission", () => {
		expect(isOwnerOrHasPermission(member, "u1", { user: ["get"] })).toBe(true)
		expect(() => assertOwnerOrPermission(member, "u1", { user: ["get"] })).not.toThrow()
	})

	it("blocks a regular user from another user's data", () => {
		expect(isOwnerOrHasPermission(member, "u2", { user: ["get"] })).toBe(false)
		expect(() =>
			assertOwnerOrPermission(member, "u2", { user: ["get"] }, "You cannot view this user"),
		).toThrow()
	})

	it("lets an admin bypass ownership via permission", () => {
		expect(isOwnerOrHasPermission(admin, "u2", { user: ["get"] })).toBe(true)
		expect(() => assertOwnerOrPermission(admin, "u2", { user: ["get"] })).not.toThrow()
	})
})
