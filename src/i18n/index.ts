import { env, type LocaleCode } from "../env"
import { en, type MessageKey } from "./locales/en"
import { id } from "./locales/id"

export type { MessageKey }
export type Locale = LocaleCode

const catalogs: Record<string, Record<MessageKey, string>> = {
	en,
	id,
}

export const LOCALE_COOKIE = "locale"

/** True when `value` is a supported locale code. */
export function isLocale(value: string | null | undefined): value is Locale {
	if (!value) return false
	return (env.SUPPORTED_LOCALES as readonly string[]).includes(value)
}

/**
 * Resolve locale for a request.
 *
 * Priority (so the language switcher cookie wins over browser defaults):
 * 1. `?lang=` / `?locale=` query
 * 2. `locale` cookie
 * 3. `Accept-Language` header
 * 4. `DEFAULT_LOCALE` env
 */
export function negotiateLocale(input: {
	query?: string | null
	cookie?: string | null
	acceptLanguage?: string | null
}): Locale {
	const fromQuery = normalizeTag(input.query)
	if (fromQuery && isLocale(fromQuery)) return fromQuery

	const fromCookie = normalizeTag(input.cookie)
	if (fromCookie && isLocale(fromCookie)) return fromCookie

	for (const tag of parseAcceptLanguage(input.acceptLanguage)) {
		if (isLocale(tag)) return tag
	}

	return env.DEFAULT_LOCALE
}

/** Read a single cookie value from a Cookie header. */
export function readCookie(cookieHeader: string | null | undefined, name: string): string | null {
	if (!cookieHeader) return null
	for (const part of cookieHeader.split(";")) {
		const [rawKey, ...rest] = part.split("=")
		if (rawKey?.trim() === name) {
			return decodeURIComponent(rest.join("=").trim())
		}
	}
	return null
}

/** Negotiate locale from a raw Request (handlers / plugins without derive). */
export function localeFromRequest(request: Request): Locale {
	const url = new URL(request.url)
	return negotiateLocale({
		query: url.searchParams.get("lang") ?? url.searchParams.get("locale"),
		cookie: readCookie(request.headers.get("cookie"), LOCALE_COOKIE),
		acceptLanguage: request.headers.get("accept-language"),
	})
}

/**
 * Translate `key` for `locale`. Missing keys fall back to English, then the key itself.
 * Params replace `{name}` placeholders.
 */
export function t(
	locale: string,
	key: MessageKey,
	params?: Record<string, string | number>,
): string {
	const catalog = catalogs[locale] ?? catalogs[env.DEFAULT_LOCALE] ?? en
	let message = catalog[key] ?? en[key] ?? key
	if (params) {
		for (const [name, value] of Object.entries(params)) {
			message = message.replaceAll(`{${name}}`, String(value))
		}
	}
	return message
}

export function availableLocales() {
	return env.SUPPORTED_LOCALES.map((code) => ({
		code,
		name: t(code, `locales.${code}` as MessageKey),
	}))
}

function normalizeTag(value: string | null | undefined): string | null {
	if (!value) return null
	const primary = value.trim().toLowerCase().split("-")[0]
	return primary || null
}

/** Parse Accept-Language into primary tags ordered by quality (highest first). */
export function parseAcceptLanguage(header: string | null | undefined): string[] {
	if (!header) return []
	return header
		.split(",")
		.map((part) => {
			const [tag, ...params] = part.trim().split(";")
			const q = params.find((p) => p.trim().startsWith("q="))
			const quality = q ? Number(q.trim().slice(2)) : 1
			return { tag: normalizeTag(tag), quality: Number.isFinite(quality) ? quality : 0 }
		})
		.filter((item): item is { tag: string; quality: number } => Boolean(item.tag) && item.quality > 0)
		.sort((a, b) => b.quality - a.quality)
		.map((item) => item.tag)
}
