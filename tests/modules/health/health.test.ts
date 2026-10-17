import { describe, expect, it } from "bun:test"

import { app } from "../../../src/app"
import { origin, request } from "../../helpers/http"

describe("module.health", () => {
	it("serves health, index, and OpenAPI", async () => {
		const health = await request("/health")
		expect(health.response.status).toBe(200)
		expect(health.body.status).toBe("ok")
		expect(health.response.headers.get("x-request-id")).toBeTruthy()
		expect(health.response.headers.get("x-content-type-options")).toBe("nosniff")

		const index = await request("/")
		expect(index.body.docs).toBe("/docs")
		expect(index.body.authReference).toBe("/api/auth/reference")
		expect(index.body.authProviders).toBe("/api/auth/providers")
		expect(index.body.i18n).toBe("/api/i18n/locales")
		expect(index.body.locales).toEqual(["en", "id"])
		expect(index.body.locale).toBe("en")
		expect(index.body.appUrl).toBeTruthy()
		expect(index.response.headers.get("content-language")).toBe("en")

		// Default env: all social providers off (no real IdP required).
		const providers = await request("/api/auth/providers")
		expect(providers.response.status).toBe(200)
		const ssoOff = {
			enabled: false,
			providerId: "oidc",
			name: "SSO",
			domain: "localhost",
			redirectUri: "http://localhost:3000/api/auth/sso/callback/oidc",
			callbackUri: "http://localhost:3000/api/auth/sso/callback/oidc",
			signInUri: "http://localhost:3000/api/auth/sign-in/sso",
			signOutUri: "http://localhost:3000/api/auth/sign-out",
		}
		expect(providers.body).toEqual({
			emailPassword: true,
			google: false,
			googleOneTap: false,
			sso: ssoOff,
			oidc: ssoOff,
		})
		expect(JSON.stringify(providers.body)).not.toMatch(/secret|CLIENT_/i)

		const spec = await request("/docs/json")
		expect(spec.response.status).toBe(200)
		expect(spec.body.paths["/api/users/me"]).toBeTruthy()
		expect(spec.body.paths["/api/auth/providers"]).toBeTruthy()
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
