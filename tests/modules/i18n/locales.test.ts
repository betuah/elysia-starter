import { describe, expect, it } from "bun:test"

import { request } from "../../helpers/http"

describe("module.i18n", () => {
	it("lists locales and reports current from cookie", async () => {
		const result = await request("/api/i18n/locales", {
			headers: { cookie: "locale=id" },
		})
		expect(result.response.status).toBe(200)
		expect(result.response.headers.get("content-language")).toBe("id")
		expect(result.body.code).toBe("OK")
		expect(result.body.message).toBe("Berhasil")
		expect(result.body.data.current).toBe("id")
		expect(result.body.data.default).toBe("en")
		expect(result.body.data.locales).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ code: "en" }),
				expect.objectContaining({ code: "id" }),
			]),
		)
	})

	it("honors ?lang= query over Accept-Language", async () => {
		const result = await request("/api/i18n/locales?lang=id", {
			headers: { "accept-language": "en-US,en;q=0.9" },
		})
		expect(result.response.status).toBe(200)
		expect(result.body.data.current).toBe("id")
		expect(result.response.headers.get("content-language")).toBe("id")
	})

	it("translates common API errors via Accept-Language", async () => {
		const en = await request("/api/users/me")
		expect(en.response.status).toBe(401)
		expect(en.body.code).toBe("UNAUTHORIZED")
		expect(en.body.message).toBe("Authentication required")

		const id = await request("/api/users/me", {
			headers: { "accept-language": "id" },
		})
		expect(id.response.status).toBe(401)
		expect(id.body.message).toBe("Autentikasi diperlukan")
	})
})
