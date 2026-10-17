import { status } from "elysia"

import { t, type Locale, type MessageKey } from "../i18n"

export const errorCodes = [
	"UNAUTHORIZED",
	"FORBIDDEN",
	"NOT_FOUND",
	"CONFLICT",
	"VALIDATION",
	"RATE_LIMITED",
	"BANNED",
	"INTERNAL",
	"PARSE",
] as const

export type ErrorCode = (typeof errorCodes)[number]

export type FieldError = {
	field: string
	message: string
}

export type ApiError = {
	code: ErrorCode
	message: string
	/** Present on schema validation failures (`code: VALIDATION` from the error plugin). */
	errors?: FieldError[]
}

type ErrorStatus = 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500

export function fail(httpStatus: ErrorStatus, error: ApiError): never {
	throw status(httpStatus, error)
}

/** `fail` with a catalog key — preferred for user-facing API errors. */
export function failT(
	locale: Locale,
	httpStatus: ErrorStatus,
	code: ErrorCode,
	key: MessageKey,
	params?: Record<string, string | number>,
): never {
	fail(httpStatus, { code, message: t(locale, key, params) })
}
