import { Elysia, t } from "elysia"

import { listAuthProviders } from "../../auth"
import { ok } from "../../lib/response"
import { sharedModels } from "../../models"
import { successSchema } from "../../models/success"

const googleProviderShape = t.Object({
	enabled: t.Boolean(),
	redirectUri: t.String({ trusted: true }),
	callbackUri: t.String({ trusted: true }),
	oneTap: t.Boolean(),
})

const ssoProviderShape = t.Object({
	enabled: t.Boolean(),
	providerId: t.String({ trusted: true }),
	name: t.String({ trusted: true }),
	domain: t.String({ trusted: true }),
	redirectUri: t.String({ trusted: true }),
	callbackUri: t.String({ trusted: true }),
	signInUri: t.String({ trusted: true }),
	signOutUri: t.String({ trusted: true }),
})

const captchaShape = t.Object({
	enabled: t.Boolean(),
	provider: t.Union([
		t.Literal("cloudflare-turnstile"),
		t.Literal("google-recaptcha"),
		t.Literal("hcaptcha"),
		t.Literal("captchafox"),
		t.Null(),
	]),
	siteKey: t.Union([t.String({ trusted: true }), t.Null()]),
	endpoints: t.Array(t.String({ trusted: true })),
})

const providersData = t.Object({
	emailPassword: t.Literal(true),
	google: googleProviderShape,
	sso: ssoProviderShape,
	captcha: captchaShape,
})

/**
 * Public auth capability probe (no secrets).
 * Registered before Better Auth `mount` so this path is not swallowed by the handler.
 */
export const authProviders = new Elysia({
	name: "module.auth-providers",
	prefix: "/api/auth",
	tags: ["Auth"],
})
	.use(sharedModels)
	.get("/providers", () => ok(listAuthProviders()), {
		response: { 200: successSchema(providersData) },
		detail: {
			tags: ["Auth"],
			summary: "Enabled auth providers",
			operationId: "getApiAuthProviders",
			description:
				"Which sign-in methods are active (email/password, Google, SSO) plus optional captcha (`captcha.enabled`, public `siteKey`, protected `endpoints`). Absolute public URIs for IdP / Google Console registration (`google.redirectUri` / `callbackUri`, `sso.redirectUri` / `callbackUri`, `signInUri`, `signOutUri`). Built from `BETTER_AUTH_URL`; no client secrets. Google: `{BETTER_AUTH_URL}/api/auth/callback/google`. SSO: https://better-auth.com/docs/plugins/sso. Captcha: https://better-auth.com/docs/plugins/captcha",
		},
	})
