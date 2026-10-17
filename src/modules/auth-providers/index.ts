import { Elysia, t } from "elysia"

import { listAuthProviders } from "../../auth"
import { sharedModels } from "../../models"

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

const providersResponse = t.Object({
	emailPassword: t.Literal(true),
	google: t.Boolean(),
	googleOneTap: t.Boolean(),
	sso: ssoProviderShape,
	/** Alias of `sso` for older clients. */
	oidc: ssoProviderShape,
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
	.get("/providers", () => listAuthProviders(), {
		response: { 200: providersResponse },
		detail: {
			summary: "Enabled auth providers",
			description:
				"Which sign-in methods are active (email/password, Google, SSO) plus absolute public URIs for IdP registration (`sso.redirectUri` / `callbackUri`, `signInUri`, `signOutUri`). Built from `BETTER_AUTH_URL`; no client secrets. See https://better-auth.com/docs/plugins/sso",
		},
	})
