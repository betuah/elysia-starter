import { Elysia, status } from "elysia"

import { env } from "../env"
import { localeFromRequest, t } from "../i18n"

export const errors = new Elysia({ name: "errors" }).onError({ as: "global" }, ({ code, error, request }) => {
	const locale = localeFromRequest(request)

	if (code === "VALIDATION") {
		return status(422, {
			code: "VALIDATION" as const,
			message: error instanceof Error ? error.message : t(locale, "errors.validation"),
		})
	}

	if (code === "PARSE") {
		return status(400, {
			code: "PARSE" as const,
			message: t(locale, "errors.parse"),
		})
	}

	if (code === "NOT_FOUND") {
		return status(404, {
			code: "NOT_FOUND" as const,
			message: t(locale, "errors.routeNotFound"),
		})
	}

	if (code === "INTERNAL_SERVER_ERROR" || code === "UNKNOWN") {
		if (env.NODE_ENV !== "test") console.error(error)
		return status(500, {
			code: "INTERNAL" as const,
			message:
				env.NODE_ENV === "production" || !(error instanceof Error)
					? t(locale, "errors.internal")
					: error.message,
		})
	}
})
