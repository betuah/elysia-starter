import { Elysia, status } from "elysia"

import {
	authorizeDocsBasicAuth,
	docsPathRequiresAuth,
	isDocsBasicAuthConfigured,
} from "../config/docs"
import { env } from "../env"
import { createRateLimiter } from "./rate-limit"

const limiter = createRateLimiter({
	windowMs: env.RATE_LIMIT_WINDOW_MS,
	max: env.RATE_LIMIT_MAX,
})

const skipped = [/^\/health$/, /^\/docs(?:\/|$)/, /^\/api\/auth\/reference(?:\/|$)/]
const docsBasicAuthOn =
	env.DOCS_ENABLED &&
	isDocsBasicAuthConfigured(env.DOCS_BASIC_AUTH_USER, env.DOCS_BASIC_AUTH_PASSWORD)

function clientKey(request: Request) {
	if (env.TRUST_PROXY) {
		const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
		if (forwarded) return forwarded
		const realIp = request.headers.get("x-real-ip")?.trim()
		if (realIp) return realIp
	}

	return request.headers.get("x-test-ip") ?? "local"
}

function unauthorizedDocs() {
	return new Response("Unauthorized", {
		status: 401,
		headers: {
			"WWW-Authenticate": 'Basic realm="API Docs"',
			"Cache-Control": "no-store",
		},
	})
}

export const security = new Elysia({ name: "security" }).onRequest(({ request, set }) => {
		const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID()
		set.headers["x-request-id"] = requestId
		set.headers["x-content-type-options"] = "nosniff"
		set.headers["x-frame-options"] = "DENY"
		set.headers["referrer-policy"] = "no-referrer"
		set.headers["permissions-policy"] = "camera=(), microphone=(), geolocation=()"
		set.headers["x-dns-prefetch-control"] = "off"

		const path = new URL(request.url).pathname

		if (
			docsBasicAuthOn &&
			docsPathRequiresAuth(path) &&
			!authorizeDocsBasicAuth(
				request.headers.get("authorization"),
				env.DOCS_BASIC_AUTH_USER!,
				env.DOCS_BASIC_AUTH_PASSWORD!,
			)
		) {
			return unauthorizedDocs()
		}

		if (skipped.some((pattern) => pattern.test(path))) return

		const result = limiter.check(clientKey(request))
		set.headers["x-ratelimit-limit"] = String(env.RATE_LIMIT_MAX)
		set.headers["x-ratelimit-remaining"] = String(result.remaining)

		if (!result.allowed) {
			const retryAfter = Math.max(Math.ceil((result.resetAt - Date.now()) / 1000), 1)
			set.headers["retry-after"] = String(retryAfter)
			return status(429, {
				code: "RATE_LIMITED" as const,
				message: "Too many requests. Try again later.",
			})
		}
	})

export const rateLimiter = limiter
