import { betterAuth } from "better-auth"
import { oneTap } from "better-auth/plugins"
import { admin } from "better-auth/plugins/admin"
import { bearer } from "better-auth/plugins/bearer"
import { openAPI } from "better-auth/plugins/open-api"
import { sso } from "@better-auth/sso"

import { createAuthDatabaseAdapter } from "../db/auth-adapter"
import { env } from "../env"
import { sendEmail } from "../lib/email"
import { ac, roleDefinitions } from "./permissions"
import {
	buildSsoDefaultConfig,
	getAuthProvidersPublic,
	isGoogleEnabled,
	isGoogleOneTapEnabled,
	isSsoEnabled,
	type AuthProviderEnv,
} from "./providers"

function providerEnv(): AuthProviderEnv {
	return {
		BETTER_AUTH_URL: env.BETTER_AUTH_URL,
		AUTH_GOOGLE_ENABLED: env.AUTH_GOOGLE_ENABLED,
		AUTH_GOOGLE_ONE_TAP_ENABLED: env.AUTH_GOOGLE_ONE_TAP_ENABLED,
		GOOGLE_CLIENT_ID: env.GOOGLE_CLIENT_ID,
		GOOGLE_CLIENT_SECRET: env.GOOGLE_CLIENT_SECRET,
		AUTH_SSO_ENABLED: env.AUTH_SSO_ENABLED,
		AUTH_SSO_PROVIDER_ID: env.AUTH_SSO_PROVIDER_ID,
		AUTH_SSO_NAME: env.AUTH_SSO_NAME,
		AUTH_SSO_CLIENT_ID: env.AUTH_SSO_CLIENT_ID,
		AUTH_SSO_CLIENT_SECRET: env.AUTH_SSO_CLIENT_SECRET,
		AUTH_SSO_ISSUER: env.AUTH_SSO_ISSUER,
		AUTH_SSO_DOMAIN: env.AUTH_SSO_DOMAIN,
		AUTH_SSO_DISCOVERY_URL: env.AUTH_SSO_DISCOVERY_URL,
		AUTH_SSO_AUTHORIZATION_URL: env.AUTH_SSO_AUTHORIZATION_URL,
		AUTH_SSO_TOKEN_URL: env.AUTH_SSO_TOKEN_URL,
		AUTH_SSO_USERINFO_URL: env.AUTH_SSO_USERINFO_URL,
		AUTH_SSO_JWKS_URL: env.AUTH_SSO_JWKS_URL,
		AUTH_SSO_SCOPES: env.AUTH_SSO_SCOPES,
	}
}

const providers = providerEnv()
const googleOn = isGoogleEnabled(providers)
const oneTapOn = isGoogleOneTapEnabled(providers)
const ssoOn = isSsoEnabled(providers)
const ssoDefault = buildSsoDefaultConfig(providers)

const googleSocial = googleOn
	? {
			google: {
				clientId: env.GOOGLE_CLIENT_ID!,
				clientSecret: env.GOOGLE_CLIENT_SECRET!,
			},
		}
	: undefined

/** IdP issuer must be trusted for OIDC discovery fetches. */
const trustedOrigins = (() => {
	const origins = [...env.TRUSTED_ORIGINS]
	if (ssoOn && env.AUTH_SSO_ISSUER) {
		try {
			const issuerOrigin = new URL(env.AUTH_SSO_ISSUER).origin
			if (!origins.includes(issuerOrigin)) origins.push(issuerOrigin)
		} catch {
			/* ignore invalid issuer URL — gating already requires a usable issuer */
		}
	}
	return origins
})()

export const auth = betterAuth({
	appName: "Elysia Starter",
	baseURL: env.BETTER_AUTH_URL,
	secret: env.BETTER_AUTH_SECRET,
	trustedOrigins,
	database: await createAuthDatabaseAdapter(),
	emailAndPassword: {
		enabled: true,
		minPasswordLength: 8,
		maxPasswordLength: 128,
		autoSignIn: true,
		requireEmailVerification: env.REQUIRE_EMAIL_VERIFICATION,
		sendResetPassword: async ({ user, url }) => {
			await sendEmail({
				to: user.email,
				subject: "Reset your password",
				html: `<p>Hi ${user.name},</p><p><a href="${url}">Reset your password</a></p><p>If you did not request this, ignore this email.</p>`,
				text: `Reset your password: ${url}`,
			})
		},
	},
	emailVerification: {
		sendOnSignUp: true,
		autoSignInAfterVerification: true,
		sendVerificationEmail: async ({ user, url }) => {
			await sendEmail({
				to: user.email,
				subject: "Verify your email",
				html: `<p>Hi ${user.name},</p><p><a href="${url}">Verify your email</a></p>`,
				text: `Verify your email: ${url}`,
			})
		},
	},
	socialProviders: googleSocial,
	session: {
		expiresIn: 60 * 60 * 24 * 7,
		updateAge: 60 * 60 * 24,
	},
	rateLimit: {
		enabled: env.NODE_ENV !== "test",
		window: 60,
		max: 100,
		storage: "memory",
	},
	advanced: {
		useSecureCookies: env.NODE_ENV === "production",
		ipAddress: {
			ipAddressHeaders: env.TRUST_PROXY ? ["x-forwarded-for", "x-real-ip"] : [],
		},
	},
	plugins: [
		bearer(),
		openAPI({ theme: "deepSpace" }),
		admin({
			ac,
			roles: roleDefinitions,
			defaultRole: "user",
			adminRoles: ["admin"],
		}),
		sso({
			...(ssoOn && ssoDefault ? { defaultSSO: [ssoDefault] } : {}),
		}),
		...(oneTapOn
			? [
					oneTap({
						clientId: env.GOOGLE_CLIENT_ID!,
					}),
				]
			: []),
	],
})

/** Public provider flags (no secrets) for `GET /api/auth/providers`. */
export function listAuthProviders() {
	return getAuthProvidersPublic(providerEnv())
}

export type Session = typeof auth.$Infer.Session
export type SessionUser = Session["user"]
