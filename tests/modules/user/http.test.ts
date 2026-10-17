import { describe, expect, it } from "bun:test"

import { userRepository } from "../../../src/modules/user/repository"
import { request, signUp } from "../../helpers/http"

describe("module.user http", () => {
	const stamp = Date.now()

	it("lets a member patch own profile and blocks listing users", async () => {
		const member = await signUp("Member", `member-${stamp}@example.com`)

		const me = await request("/api/users/me", {
			headers: { authorization: `Bearer ${member.token}` },
		})
		expect(me.response.status).toBe(200)
		expect(me.body.email).toBe(member.user.email)

		const patched = await request("/api/users/me", {
			method: "PATCH",
			headers: {
				"content-type": "application/json",
				authorization: `Bearer ${member.token}`,
			},
			body: JSON.stringify({ name: "Member Updated" }),
		})
		expect(patched.response.status).toBe(200)
		expect(patched.body.name).toBe("Member Updated")

		const listed = await request("/api/users", {
			headers: { authorization: `Bearer ${member.token}` },
		})
		expect(listed.response.status).toBe(403)
		expect(listed.body.code).toBe("FORBIDDEN")

		const access = await request("/api/users/me/access", {
			headers: { authorization: `Bearer ${member.token}` },
		})
		expect(access.response.status).toBe(200)
		expect(access.body.role).toBe("user")
		expect(access.body.permissions.user).toBeUndefined()
	})

	it("lets an admin list users, set roles, and keeps the last admin", async () => {
		const admin = await signUp("AdminA", `admin-a-${stamp}@example.com`)
		const other = await signUp("AdminB", `admin-b-${stamp}@example.com`)

		await userRepository.update(admin.user.id, { role: "admin" })
		await userRepository.update(other.user.id, { role: "admin" })

		const visible = await request("/api/users", {
			headers: { authorization: `Bearer ${admin.token}` },
		})
		expect(visible.response.status).toBe(200)
		expect(visible.body.total).toBeGreaterThan(0)

		const changed = await request(`/api/users/${other.user.id}/role`, {
			method: "PATCH",
			headers: {
				"content-type": "application/json",
				authorization: `Bearer ${admin.token}`,
			},
			body: JSON.stringify({ role: "user" }),
		})
		expect(changed.response.status).toBe(200)
		expect(changed.body.role).toBe("user")

		const hidden = await request("/api/users", {
			headers: { authorization: `Bearer ${other.token}` },
		})
		expect(hidden.response.status).toBe(403)

		const lastAdmin = await request(`/api/users/${admin.user.id}/role`, {
			method: "PATCH",
			headers: {
				"content-type": "application/json",
				authorization: `Bearer ${admin.token}`,
			},
			body: JSON.stringify({ role: "user" }),
		})
		expect(lastAdmin.response.status).toBe(409)
		expect(lastAdmin.body.code).toBe("CONFLICT")
	})

	it("lets an admin create a user", async () => {
		const admin = await signUp("Creator", `creator-${stamp}@example.com`)
		await userRepository.update(admin.user.id, { role: "admin" })

		const created = await request("/api/users", {
			method: "POST",
			headers: {
				"content-type": "application/json",
				authorization: `Bearer ${admin.token}`,
			},
			body: JSON.stringify({
				name: "Invited",
				email: `invited-${stamp}@example.com`,
				password: "InvitePass1!",
				role: "user",
			}),
		})
		expect(created.response.status).toBe(200)
		expect(created.body.email).toBe(`invited-${stamp}@example.com`)
		expect(created.body.role).toBe("user")

		const asMember = await signUp("Nope", `nope-${stamp}@example.com`)
		const forbidden = await request("/api/users", {
			method: "POST",
			headers: {
				"content-type": "application/json",
				authorization: `Bearer ${asMember.token}`,
			},
			body: JSON.stringify({
				name: "X",
				email: `x-${stamp}@example.com`,
				password: "InvitePass1!",
			}),
		})
		expect(forbidden.response.status).toBe(403)
	})
})
