import { Elysia } from "elysia"

import { env } from "../env"

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"])

/**
 * Lightweight HTTP **access** log (structured console).
 *
 * Distinct from DB **audit** (`src/lib/audit.ts` / `audit_log` table):
 * - **Audit** = business events (profile change, ban, role, …) stored in Postgres
 * - **Access** = per-request method/path/status/duration — console only (avoids DB flood)
 *
 * Disabled in `NODE_ENV=test`. Set `ACCESS_LOG=false` to silence in other envs.
 */
export const accessLog = new Elysia({ name: "plugin.access-log" })
	.derive({ as: "global" }, () => ({
		accessStartedAt: performance.now(),
	}))
	.onAfterResponse({ as: "global" }, ({ request, set, accessStartedAt }) => {
		if (env.NODE_ENV === "test") return
		if (process.env.ACCESS_LOG === "false") return

		const url = new URL(request.url)
		const method = request.method.toUpperCase()
		const status =
			typeof set.status === "number"
				? set.status
				: typeof set.status === "string"
					? Number.parseInt(set.status, 10) || 200
					: 200
		const durationMs = Math.round(performance.now() - accessStartedAt)

		console.log(
			JSON.stringify({
				type: "http.access",
				method,
				path: url.pathname,
				status,
				durationMs,
				mutating: MUTATING.has(method),
			}),
		)
	})
