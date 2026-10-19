import { betterAuth } from "better-auth"
import { captcha, oneTap } from "better-auth/plugins"
import { admin } from "better-auth/plugins/admin"
import { bearer } from "better-auth/plugins/bearer"
import { openAPI } from "better-auth/plugins/open-api"
import { sso } from "@better-auth/sso"
import * as React from "react"

import { createAuthDatabaseAdapter } from "../db/auth-adapter"
import EmailVerificationEmail from "../emails/email-verification"
import PasswordResetEmail from "../emails/password-reset"
import { env } from "../env"
import { renderEmail, sendEmail } from "../lib/email"
import {
	buildCaptchaPluginOptions,
	getCaptchaPublic,
	type CaptchaEnv,
} from "./captcha"
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

function captchaEnv(): CaptchaEnv {
	return {
		CAPTCHA_ENABLED: env.CAPTCHA_ENABLED,
		CAPTCHA_PROVIDER: env.CAPTCHA_PROVIDER,
		CAPTCHA_SECRET_KEY: env.CAPTCHA_SECRET_KEY,
		CAPTCHA_SITE_KEY: env.CAPTCHA_SITE_KEY,
		CAPTCHA_MIN_SCORE: env.CAPTCHA_MIN_SCORE,
	}
}

const providers = providerEnv()
const googleOn = isGoogleEnabled(providers)
const oneTapOn = isGoogleOneTapEnabled(providers)
const ssoOn = isSsoEnabled(providers)
const ssoDefault = buildSsoDefaultConfig(providers)
const captchaOptions = buildCaptchaPluginOptions(captchaEnv())

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
	appName: env.APP_NAME,
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
			const html = await renderEmail(
				React.createElement(PasswordResetEmail, {
					name: user.name,
					url,
				}),
			)
			await sendEmail({
				to: user.email,
				subject: "Reset your password",
				html,
				text: `Hi ${user.name},\n\nReset your password: ${url}\n\nIf you did not request this, ignore this email.`,
			})
		},
	},
	emailVerification: {
		sendOnSignUp: true,
		autoSignInAfterVerification: true,
		sendVerificationEmail: async ({ user, url }) => {
			const html = await renderEmail(
				React.createElement(EmailVerificationEmail, {
					name: user.name,
					url,
				}),
			)
			await sendEmail({
				to: user.email,
				subject: "Verify your email",
				html,
				text: `Hi ${user.name},\n\nVerify your email: ${url}`,
			})
		},
	},
	socialProviders: googleSocial,
	session: {
		expiresIn: 60 * 60 * 24 * 7,
		updateAge: 60 * 60 * 24,
	},
	rateLimit: {
		enabled: env.RATE_LIMIT_ENABLED,
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
		// Same `DOCS_ENABLED` gate as Scalar `/docs` — omit plugin so `/api/auth/reference` 404s.
		...(env.DOCS_ENABLED ? [openAPI({ theme: "deepSpace" })] : []),
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
		...(captchaOptions ? [captcha(captchaOptions)] : []),
	],
})

/** Public provider flags (no secrets) for `GET /api/auth/providers`. */
export function listAuthProviders() {
	return {
		...getAuthProvidersPublic(providerEnv()),
		captcha: getCaptchaPublic(captchaEnv()),
	}
}

export type Session = typeof auth.$Infer.Session
export type SessionUser = Session["user"]
