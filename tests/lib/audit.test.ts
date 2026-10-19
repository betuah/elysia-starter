import { describe, expect, it } from "bun:test"

import { auditContextFromHeaders, recordAudit } from "../../src/lib/audit"
import { auditRepository } from "../../src/modules/audit/repository"

describe("lib.audit", () => {
	it("persists a row via recordAudit and reads it back", async () => {
		const action = `test.unit.${Date.now()}`
		await recordAudit({
			actorUserId: null,
			action,
			resourceType: "system",
			resourceId: "fixture",
			metadata: { ok: true },
			ip: "127.0.0.1",
			userAgent: "bun-test",
		})

		const { items } = await auditRepository.list({
			limit: 20,
			offset: 0,
			action,
		})
		expect(items.length).toBe(1)
		expect(items[0]?.action).toBe(action)
		expect(items[0]?.metadata).toEqual({ ok: true })
		expect(items[0]?.ip).toBe("127.0.0.1")
	})

	it("reads ip and user-agent from headers", () => {
		const headers = new Headers({
			"x-forwarded-for": "203.0.113.10, 10.0.0.1",
			"user-agent": "TestAgent/1.0",
		})
		expect(auditContextFromHeaders(headers)).toEqual({
			ip: "203.0.113.10",
			userAgent: "TestAgent/1.0",
		})
	})
})
