import { Elysia } from "elysia"

import { localeFromRequest } from "../i18n"

/**
 * Derives `locale` on every request and sets `Content-Language` on responses.
 * Use `locale` in handlers/services; prefer `localeFromRequest(request)` in macros.
 */
export const i18nPlugin = new Elysia({ name: "i18n" })
	.derive({ as: "global" }, ({ request }) => ({
		locale: localeFromRequest(request),
	}))
	.onAfterHandle({ as: "global" }, ({ set, locale }) => {
		set.headers["content-language"] = locale
	})
