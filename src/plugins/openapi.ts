import { openapi } from "@elysia/openapi"
import { Elysia } from "elysia"

import { env } from "../env"

/**
 * Scalar UI at `/docs` + OpenAPI JSON at `/docs/json`.
 * Gated by `DOCS_ENABLED` (see `src/config/docs.ts` / `src/env.ts`).
 */
export const docs = env.DOCS_ENABLED
	? new Elysia({ name: "docs" }).use(
			openapi({
				path: "/docs",
				// Expand all tags so Auth (`GET /api/auth/providers`) is visible without opening the sidebar group.
				scalar: {
					defaultOpenAllTags: true,
				},
				documentation: {
					info: {
						title: "Elysia Starter",
						version: "0.1.0",
						description:
							"Feature-based Elysia starter with Better Auth, role-based access control, ownership checks, and security headers. Authenticated routes accept an httpOnly session cookie or `Authorization: Bearer <token>` from the `set-auth-token` response header. Auth endpoints (sign-in, password reset, Google, SSO, admin ban/create/delete) are documented at /api/auth/reference. For IdP / Google Console registration, `GET /api/auth/providers` exposes absolute URIs under `google` and `sso` (`redirectUri`/`callbackUri`, plus SSO `signInUri`/`signOutUri`) derived from BETTER_AUTH_URL — Google: `/api/auth/callback/google`; SSO: https://better-auth.com/docs/plugins/sso",
					},
					servers: [{ url: env.BETTER_AUTH_URL, description: "Current environment" }],
					tags: [
						{ name: "System", description: "Service metadata" },
						{ name: "Health", description: "Liveness checks" },
						{
							name: "Auth",
							description:
								"Public auth capability probe and Google/SSO registration URIs. Full Better Auth surface (sign-in, Google callback, SSO callback, admin) at /api/auth/reference.",
						},
						{
							name: "Users",
							description:
								"Own profile + admin user management. Thin wrappers over Better Auth admin APIs; full auth surface at /api/auth/reference.",
						},
					],
					components: {
						securitySchemes: {
							bearerAuth: {
								type: "http",
								scheme: "bearer",
								description:
									"Signed session token returned in the set-auth-token header after sign-in.",
							},
						},
					},
				},
			}),
		)
	: new Elysia({ name: "docs" })
