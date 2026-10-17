import { describe, expect, it } from "bun:test"

import {
	authorizeDocsBasicAuth,
	docsPathRequiresAuth,
	evaluateDocsBasicAuthRequirement,
	isDocsBasicAuthConfigured,
	resolveDocsEnabled,
} from "../../src/config/docs"

describe("config.docs", () => {
	it("defaults on outside production, off in production when unset", () => {
		expect(resolveDocsEnabled({ nodeEnv: "development" })).toBe(true)
		expect(resolveDocsEnabled({ nodeEnv: "test" })).toBe(true)
		expect(resolveDocsEnabled({ nodeEnv: "production" })).toBe(false)
	})

	it("honors explicit DOCS_ENABLED", () => {
		expect(resolveDocsEnabled({ docsEnabled: true, nodeEnv: "production" })).toBe(true)
		expect(resolveDocsEnabled({ docsEnabled: false, nodeEnv: "development" })).toBe(false)
	})

	it("requires both basic-auth credentials", () => {
		expect(isDocsBasicAuthConfigured(undefined, undefined)).toBe(false)
		expect(isDocsBasicAuthConfigured("u", undefined)).toBe(false)
		expect(isDocsBasicAuthConfigured(undefined, "p")).toBe(false)
		expect(isDocsBasicAuthConfigured("u", "p")).toBe(true)
	})

	it("requires basic auth in production when docs are enabled", () => {
		expect(
			evaluateDocsBasicAuthRequirement({
				docsEnabled: true,
				user: undefined,
				password: undefined,
				nodeEnv: "production",
			}).action,
		).toBe("throw")
		expect(
			evaluateDocsBasicAuthRequirement({
				docsEnabled: true,
				user: "docs",
				password: "change-me",
				nodeEnv: "production",
			}).action,
		).toBe("ok")
		expect(
			evaluateDocsBasicAuthRequirement({
				docsEnabled: false,
				user: undefined,
				password: undefined,
				nodeEnv: "production",
			}).action,
		).toBe("ok")
	})

	it("warns in development when docs enabled without credentials", () => {
		expect(
			evaluateDocsBasicAuthRequirement({
				docsEnabled: true,
				user: undefined,
				password: undefined,
				nodeEnv: "development",
			}).action,
		).toBe("warn")
		expect(
			evaluateDocsBasicAuthRequirement({
				docsEnabled: true,
				user: undefined,
				password: undefined,
				nodeEnv: "test",
			}).action,
		).toBe("ok")
	})

	it("matches docs and auth reference paths", () => {
		expect(docsPathRequiresAuth("/docs")).toBe(true)
		expect(docsPathRequiresAuth("/docs/json")).toBe(true)
		expect(docsPathRequiresAuth("/api/auth/reference")).toBe(true)
		expect(docsPathRequiresAuth("/api/auth/open-api/generate-schema")).toBe(true)
		expect(docsPathRequiresAuth("/health")).toBe(false)
		expect(docsPathRequiresAuth("/api/auth/sign-in/email")).toBe(false)
	})

	it("validates Basic Auth credentials", () => {
		const header = `Basic ${btoa("docs:s3cret")}`
		expect(authorizeDocsBasicAuth(header, "docs", "s3cret")).toBe(true)
		expect(authorizeDocsBasicAuth(header, "docs", "wrong")).toBe(false)
		expect(authorizeDocsBasicAuth(null, "docs", "s3cret")).toBe(false)
		expect(authorizeDocsBasicAuth("Bearer token", "docs", "s3cret")).toBe(false)
	})
})
