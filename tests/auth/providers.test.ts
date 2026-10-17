import { describe, expect, it } from "bun:test"

import {
	buildSsoDefaultConfig,
	getAuthProvidersPublic,
	isGoogleEnabled,
	isGoogleOneTapEnabled,
	isSsoEnabled,
	type AuthProviderEnv,
} from "../../src/auth/providers"

const base: AuthProviderEnv = {
	BETTER_AUTH_URL: "http://localhost:3000",
	AUTH_GOOGLE_ENABLED: false,
	AUTH_GOOGLE_ONE_TAP_ENABLED: false,
	GOOGLE_CLIENT_ID: undefined,
	GOOGLE_CLIENT_SECRET: undefined,
	AUTH_SSO_ENABLED: false,
	AUTH_SSO_PROVIDER_ID: "oidc",
	AUTH_SSO_NAME: "SSO",
	AUTH_SSO_CLIENT_ID: undefined,
	AUTH_SSO_CLIENT_SECRET: undefined,
	AUTH_SSO_ISSUER: undefined,
	AUTH_SSO_DOMAIN: "localhost",
	AUTH_SSO_DISCOVERY_URL: undefined,
	AUTH_SSO_AUTHORIZATION_URL: undefined,
	AUTH_SSO_TOKEN_URL: undefined,
	AUTH_SSO_USERINFO_URL: undefined,
	AUTH_SSO_JWKS_URL: undefined,
	AUTH_SSO_SCOPES: ["openid", "profile", "email"],
}

describe("auth.providers gating", () => {
	it("keeps Google off without toggle or credentials", () => {
		expect(isGoogleEnabled(base)).toBe(false)
		expect(
			isGoogleEnabled({
				...base,
				AUTH_GOOGLE_ENABLED: true,
				GOOGLE_CLIENT_ID: "id",
			}),
		).toBe(false)
		expect(
			isGoogleEnabled({
				...base,
				AUTH_GOOGLE_ENABLED: true,
				GOOGLE_CLIENT_ID: "id",
				GOOGLE_CLIENT_SECRET: "secret",
			}),
		).toBe(true)
	})

	it("requires Google on before One Tap", () => {
		expect(
			isGoogleOneTapEnabled({
				...base,
				AUTH_GOOGLE_ENABLED: true,
				AUTH_GOOGLE_ONE_TAP_ENABLED: true,
				GOOGLE_CLIENT_ID: "id",
				GOOGLE_CLIENT_SECRET: "secret",
			}),
		).toBe(true)
		expect(
			isGoogleOneTapEnabled({
				...base,
				AUTH_GOOGLE_ONE_TAP_ENABLED: true,
				GOOGLE_CLIENT_ID: "id",
				GOOGLE_CLIENT_SECRET: "secret",
			}),
		).toBe(false)
	})

	it("enables SSO with issuer + discovery or explicit endpoints", () => {
		expect(isSsoEnabled(base)).toBe(false)
		expect(
			isSsoEnabled({
				...base,
				AUTH_SSO_ENABLED: true,
				AUTH_SSO_CLIENT_ID: "id",
				AUTH_SSO_CLIENT_SECRET: "secret",
				AUTH_SSO_ISSUER: "https://idp.example.com",
				AUTH_SSO_DISCOVERY_URL: "https://idp.example.com/.well-known/openid-configuration",
			}),
		).toBe(true)
		expect(
			isSsoEnabled({
				...base,
				AUTH_SSO_ENABLED: true,
				AUTH_SSO_CLIENT_ID: "id",
				AUTH_SSO_CLIENT_SECRET: "secret",
				AUTH_SSO_ISSUER: "https://idp.example.com",
				AUTH_SSO_AUTHORIZATION_URL: "https://idp.example.com/auth",
				AUTH_SSO_TOKEN_URL: "https://idp.example.com/token",
			}),
		).toBe(true)
		expect(
			isSsoEnabled({
				...base,
				AUTH_SSO_ENABLED: true,
				AUTH_SSO_CLIENT_ID: "id",
				AUTH_SSO_CLIENT_SECRET: "secret",
				AUTH_SSO_DISCOVERY_URL: "https://idp.example.com/.well-known/openid-configuration",
			}),
		).toBe(false)
		expect(
			buildSsoDefaultConfig({
				...base,
				AUTH_SSO_ENABLED: true,
				AUTH_SSO_CLIENT_ID: "id",
				AUTH_SSO_CLIENT_SECRET: "secret",
				AUTH_SSO_ISSUER: "https://idp.example.com",
				AUTH_SSO_DOMAIN: "example.com",
				AUTH_SSO_DISCOVERY_URL: "https://idp.example.com/.well-known/openid-configuration",
			}),
		).toMatchObject({
			providerId: "oidc",
			domain: "example.com",
			oidcConfig: {
				issuer: "https://idp.example.com",
				clientId: "id",
				clientSecret: "secret",
				discoveryEndpoint: "https://idp.example.com/.well-known/openid-configuration",
				pkce: true,
				scopes: ["openid", "profile", "email"],
			},
		})
	})

	it("exposes public google/sso flags and IdP URIs without secrets", () => {
		const publicFlags = getAuthProvidersPublic({
			...base,
			AUTH_GOOGLE_ENABLED: true,
			GOOGLE_CLIENT_ID: "gid",
			GOOGLE_CLIENT_SECRET: "gsecret",
			AUTH_SSO_ENABLED: true,
			AUTH_SSO_CLIENT_ID: "oid",
			AUTH_SSO_CLIENT_SECRET: "osecret",
			AUTH_SSO_ISSUER: "https://idp.example.com",
			AUTH_SSO_DISCOVERY_URL: "https://idp.example.com/.well-known/openid-configuration",
			AUTH_SSO_NAME: "Company SSO",
			AUTH_SSO_PROVIDER_ID: "company",
			AUTH_SSO_DOMAIN: "company.com",
		})
		expect(publicFlags).toEqual({
			emailPassword: true,
			google: {
				enabled: true,
				redirectUri: "http://localhost:3000/api/auth/callback/google",
				callbackUri: "http://localhost:3000/api/auth/callback/google",
				oneTap: false,
			},
			sso: {
				enabled: true,
				providerId: "company",
				name: "Company SSO",
				domain: "company.com",
				redirectUri: "http://localhost:3000/api/auth/sso/callback/company",
				callbackUri: "http://localhost:3000/api/auth/sso/callback/company",
				signInUri: "http://localhost:3000/api/auth/sign-in/sso",
				signOutUri: "http://localhost:3000/api/auth/sign-out",
			},
		})
		expect(JSON.stringify(publicFlags)).not.toContain("secret")
		expect(publicFlags).not.toHaveProperty("oidc")
		expect(publicFlags).not.toHaveProperty("googleOneTap")
	})
})
