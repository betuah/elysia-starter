import { describe, expect, it } from "bun:test"

import { userRepository } from "../../src/modules/user/repository"
import { request, signUp } from "../helpers/http"

describe("plugins.errors validation", () => {
	const stamp = Date.now()

	it("returns per-field errors for an invalid body", async () => {
		const member = await signUp("ValBody", `val-body-${stamp}@example.com`)

		const result = await request("/api/users/me", {
			method: "PATCH",
			headers: {
				"content-type": "application/json",
				authorization: `Bearer ${member.token}`,
			},
			body: JSON.stringify({ name: "" }),
		})

		expect(result.response.status).toBe(422)
		expect(result.body.code).toBe("VALIDATION")
		expect(result.body.message).toBe("Request validation failed")
		expect(Array.isArray(result.body.errors)).toBe(true)
		expect(result.body.errors.length).toBeGreaterThan(0)
		const nameError = result.body.errors.find((e: { field: string }) => e.field === "body.name")
		expect(nameError).toBeDefined()
		expect(typeof nameError.message).toBe("string")
		expect(nameError.message.length).toBeGreaterThan(0)
		expect(result.body).not.toHaveProperty("data")
	})

	it("returns per-field errors for an invalid query", async () => {
		const admin = await signUp("ValQuery", `val-query-${stamp}@example.com`)
		await userRepository.update(admin.user.id, { role: "admin" })

		try {
			const result = await request("/api/users?pageSize=abc", {
				headers: { authorization: `Bearer ${admin.token}` },
			})

			expect(result.response.status).toBe(422)
			expect(result.body.code).toBe("VALIDATION")
			expect(result.body.message).toBe("Request validation failed")
			expect(Array.isArray(result.body.errors)).toBe(true)
			const pageSizeError = result.body.errors.find(
				(e: { field: string }) => e.field === "query.pageSize",
			)
			expect(pageSizeError).toBeDefined()
			expect(typeof pageSizeError.message).toBe("string")
			expect(pageSizeError.message.length).toBeGreaterThan(0)
			expect(result.body).not.toHaveProperty("data")
		} finally {
			// Avoid leaving an extra admin that breaks the "last admin" suite.
			await userRepository.update(admin.user.id, { role: "user" })
		}
	})

	it("omits errors on non-validation failures", async () => {
		const result = await request("/api/users/me")
		expect(result.response.status).toBe(401)
		expect(result.body.code).toBe("UNAUTHORIZED")
		expect(result.body.message).toBeTruthy()
		expect(result.body.errors).toBeUndefined()
		expect(result.body).not.toHaveProperty("data")
	})
})
