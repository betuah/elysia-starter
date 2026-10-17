import { describe, expect, it } from "bun:test"

import { app } from "../../../src/app"
import { origin, request } from "../../helpers/http"

describe("module.health", () => {
	it("serves health, index, and OpenAPI", async () => {
		const health = await request("/health")
		expect(health.response.status).toBe(200)
		expect(health.body.code).toBe("OK")
		expect(health.body.data.status).toBe("ok")
		expect(health.response.headers.get("x-request-id")).toBeTruthy()
		expect(health.response.headers.get("x-content-type-options")).toBe("nosniff")

		const index = await request("/")
		expect(index.body.code).toBe("OK")
		expect(index.body.data.docs).toBe("/docs")
		expect(index.body.data.authReference).toBe("/api/auth/reference")
		expect(index.body.data.authProviders).toBe("/api/auth/providers")
		expect(index.body.data.i18n).toBe("/api/i18n/locales")
		expect(index.body.data.locales).toEqual(["en", "id"])
		expect(index.body.data.locale).toBe("en")
		expect(index.body.data.appUrl).toBeTruthy()
		expect(index.response.headers.get("content-language")).toBe("en")

		// Default env: all social providers off (no real IdP required).
		const providers = await request("/api/auth/providers")
		expect(providers.response.status).toBe(200)
		expect(providers.body).toEqual({
			code: "OK",
			message: "Success",
			data: {
				emailPassword: true,
				google: {
					enabled: false,
					redirectUri: "http://localhost:3000/api/auth/callback/google",
					callbackUri: "http://localhost:3000/api/auth/callback/google",
					oneTap: false,
				},
				sso: {
					enabled: false,
					providerId: "oidc",
					name: "SSO",
					domain: "localhost",
					redirectUri: "http://localhost:3000/api/auth/sso/callback/oidc",
					callbackUri: "http://localhost:3000/api/auth/sso/callback/oidc",
					signInUri: "http://localhost:3000/api/auth/sign-in/sso",
					signOutUri: "http://localhost:3000/api/auth/sign-out",
				},
			},
		})
		expect(providers.body.data).not.toHaveProperty("oidc")
		expect(JSON.stringify(providers.body)).not.toMatch(/secret|CLIENT_/i)

		const spec = await request("/docs/json")
		expect(spec.response.status).toBe(200)
		expect(spec.body.paths["/api/users/me"]).toBeTruthy()
		const providersOp = spec.body.paths["/api/auth/providers"]?.get
		expect(providersOp).toBeTruthy()
		expect(providersOp.summary).toBe("Enabled auth providers")
		expect(providersOp.tags).toContain("Auth")
		expect(providersOp.operationId).toBe("getApiAuthProviders")
		expect(spec.body.tags?.some((tag: { name: string }) => tag.name === "Auth")).toBe(true)
		expect(spec.body.paths["/api/posts"]).toBeUndefined()
		expect(spec.body.components.securitySchemes.bearerAuth.scheme).toBe("bearer")

		const page = await app.handle(new Request(`${origin}/docs`))
		expect(page.status).toBe(200)
		expect(page.headers.get("content-type")).toContain("text/html")
	})

	it("allows a trusted browser origin", async () => {
		const result = await request("/health", {
			headers: { origin: "http://localhost:3000" },
		})
		expect(result.response.headers.get("access-control-allow-origin")).toBe("http://localhost:3000")
	})
})
