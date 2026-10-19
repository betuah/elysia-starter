import { cors } from "@elysia/cors"
import cluster from "node:cluster"
import { Elysia } from "elysia"

import { auth } from "./auth"
import { resolveClusterWorkers, shouldUseCluster } from "./config/cluster"
import { shouldAttachCronToHttpApp } from "./config/cron"
import { elysiaOptions } from "./config/server"
import { env } from "./env"
import { t } from "./i18n"
import { ok } from "./lib/response"
import { audit } from "./modules/audit"
import { authProviders } from "./modules/auth-providers"
import { health } from "./modules/health"
import { i18nRoutes } from "./modules/i18n"
import { users } from "./modules/user"
import { accessLog } from "./plugins/access-log"
import { authPlugin } from "./plugins/auth"
import { createCronPlugin } from "./cron"
import { errors } from "./plugins/error"
import { i18nPlugin } from "./plugins/i18n"
import { docs } from "./plugins/openapi"
import { security } from "./plugins/security"
import { storageStatic } from "./plugins/storage-static"

const clustered = shouldUseCluster(resolveClusterWorkers(env.CLUSTER_WORKERS), env.NODE_ENV)
// ENABLE_CRON is read from process.env (not `env`) on purpose: it is a per-fork
// escape hatch set via cluster.fork({ ENABLE_CRON: "true" }) on exactly one worker.
// Putting it on the shared `env` object would imply a global toggle like CRON_ENABLED.
const attachCron = shouldAttachCronToHttpApp({
	cronEnabled: env.CRON_ENABLED,
	clustered,
	isPrimary: cluster.isPrimary,
	enableCronFlag: process.env.ENABLE_CRON,
})

const base = new Elysia(elysiaOptions)
	.use(accessLog)
	.use(security)
	.use(
		cors({
			origin: env.TRUSTED_ORIGINS,
			methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
			credentials: true,
			allowedHeaders: [
				"Content-Type",
				"Authorization",
				"X-Request-Id",
				"Accept-Language",
				// Better Auth captcha plugin token (when CAPTCHA_ENABLED)
				"x-captcha-response",
			],
			exposeHeaders: [
				"set-auth-token",
				"x-request-id",
				"x-ratelimit-limit",
				"x-ratelimit-remaining",
				"retry-after",
				"content-language",
			],
		}),
	)
	.use(i18nPlugin)
	.use(errors)
	.use(authPlugin)
	// Before Better Auth mount so `/api/auth/providers` is not swallowed at runtime.
	.use(authProviders)
	.mount(auth.handler)
	.use(health)
	.use(i18nRoutes)
	.use(users)
	.use(audit)
	.use(storageStatic)
	.get(
		"/",
		({ locale }) =>
			ok(
				{
					name: env.APP_NAME,
					...(env.DOCS_ENABLED
						? { docs: "/docs", authReference: "/api/auth/reference" }
						: {}),
					authProviders: "/api/auth/providers",
					i18n: "/api/i18n/locales",
					locales: env.SUPPORTED_LOCALES,
					locale,
					health: "/health",
					appUrl: env.APP_URL,
				},
				{ message: t(locale, "common.success") },
			),
		{
			// Ops discovery at runtime; omit from Scalar /docs.
			detail: { hide: true },
		},
	)
	// OpenAPI after routes so `/docs/json` always snapshots the full tree (incl. Auth).
	// No-op plugin when `DOCS_ENABLED=false`.
	.use(docs)

export const app = attachCron ? base.use(createCronPlugin()) : base

export type App = typeof app
