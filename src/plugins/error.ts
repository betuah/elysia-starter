import { Elysia, status, ValidationError } from "elysia"

import { env } from "../env"
import type { FieldError } from "../lib/error"
import { localeFromRequest, t } from "../i18n"

const requestLocations = new Set(["body", "query", "params", "headers", "cookie"])

function fieldPath(type: string, path: unknown): string {
	const raw = Array.isArray(path) ? path[0] : path
	const cleaned =
		typeof raw === "string" ? raw.replace(/^\//, "").replaceAll("/", ".") : ""

	if (requestLocations.has(type)) {
		return cleaned ? `${type}.${cleaned}` : type
	}

	return cleaned || "root"
}

function mapValidationErrors(error: ValidationError): FieldError[] {
	return error.all
		.filter((entry) => entry.summary || entry.message)
		.map((entry) => ({
			field: fieldPath(error.type, entry.path),
			message: entry.summary || entry.message,
		}))
}

export const errors = new Elysia({ name: "errors" }).onError({ as: "global" }, ({ code, error, request }) => {
	const locale = localeFromRequest(request)

	if (code === "VALIDATION") {
		const fieldErrors = error instanceof ValidationError ? mapValidationErrors(error) : []
		return status(422, {
			code: "VALIDATION" as const,
			message: t(locale, "errors.validation"),
			...(fieldErrors.length > 0 ? { errors: fieldErrors } : {}),
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
