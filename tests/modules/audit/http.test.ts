import { describe, expect, it } from "bun:test"

import { recordAudit } from "../../../src/lib/audit"
import { userRepository } from "../../../src/modules/user/repository"
import { request, signUp } from "../../helpers/http"

describe("module.audit http", () => {
	const stamp = Date.now()

	it("records audit events and lets an admin list them with filters", async () => {
		const admin = await signUp("AuditAdmin", `audit-admin-${stamp}@example.com`)
		const member = await signUp("AuditMember", `audit-member-${stamp}@example.com`)
		await userRepository.update(admin.user.id, { role: "admin" })

		const patched = await request("/api/users/me", {
			method: "PATCH",
			headers: {
				"content-type": "application/json",
				authorization: `Bearer ${member.token}`,
			},
			body: JSON.stringify({ name: "Audit Member Updated" }),
		})
		expect(patched.response.status).toBe(200)

		await recordAudit({
			actorUserId: admin.user.id,
			action: "test.manual",
			resourceType: "user",
			resourceId: member.user.id,
			metadata: { reason: "fixture" },
		})

		const forbidden = await request("/api/audit", {
			headers: { authorization: `Bearer ${member.token}` },
		})
		expect(forbidden.response.status).toBe(403)
		expect(forbidden.body.code).toBe("FORBIDDEN")

		const listed = await request("/api/audit?page=1&pageSize=50", {
			headers: { authorization: `Bearer ${admin.token}` },
		})
		expect(listed.response.status).toBe(200)
		expect(listed.body.code).toBe("OK")
		expect(listed.body.data.meta.page).toBe(1)
		expect(Array.isArray(listed.body.data.items)).toBe(true)

		const actions = listed.body.data.items.map((row: { action: string }) => row.action)
		expect(actions).toContain("user.profile.update")
		expect(actions).toContain("auth.session.create")
		expect(actions).toContain("test.manual")

		const filtered = await request(
			`/api/audit?action=user.profile.update&userId=${encodeURIComponent(member.user.id)}`,
			{ headers: { authorization: `Bearer ${admin.token}` } },
		)
		expect(filtered.response.status).toBe(200)
		expect(filtered.body.data.items.length).toBeGreaterThan(0)
		for (const row of filtered.body.data.items as Array<{
			action: string
			actorUserId: string | null
		}>) {
			expect(row.action).toBe("user.profile.update")
			expect(row.actorUserId).toBe(member.user.id)
		}
	})
})
