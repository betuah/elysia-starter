import { Elysia, status } from "elysia"

import { auth } from "../auth"
import type { PermissionRequest } from "../auth/permissions"
import { hasPermission } from "../auth/permissions"
import { toActor } from "../lib/actor"
import { localeFromRequest, t } from "../i18n"

async function requireUser(request: Request) {
	const locale = localeFromRequest(request)
	const session = await auth.api.getSession({ headers: request.headers })
	if (!session) {
		return {
			error: status(401, {
				code: "UNAUTHORIZED" as const,
				message: t(locale, "errors.unauthorized"),
			}),
		}
	}

	const user = toActor(session.user)
	if (user.banned) {
		return {
			error: status(403, {
				code: "BANNED" as const,
				message: t(locale, "errors.banned"),
			}),
		}
	}

	return { user, sessionId: session.session.id, locale }
}

export const authPlugin = new Elysia({ name: "auth.guard" }).macro({
	auth: {
		async resolve({ request }) {
			const result = await requireUser(request)
			if ("error" in result && result.error) return result.error
			return { user: result.user, sessionId: result.sessionId, locale: result.locale }
		},
	},
	permission: (requestPermissions: PermissionRequest) => ({
		async resolve({ request }) {
			const result = await requireUser(request)
			if ("error" in result && result.error) return result.error
			if (!hasPermission(result.user.role, requestPermissions)) {
				return status(403, {
					code: "FORBIDDEN" as const,
					message: t(result.locale, "errors.forbidden"),
				})
			}
			return { user: result.user, sessionId: result.sessionId, locale: result.locale }
		},
	}),
})
