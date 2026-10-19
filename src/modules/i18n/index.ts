import { Elysia, t } from "elysia"

import { env } from "../../env"
import { availableLocales, t as translate } from "../../i18n"
import { ok } from "../../lib/response"
import { sharedModels } from "../../models"
import { successSchema } from "../../models/success"
import { i18nPlugin } from "../../plugins/i18n"

const localesData = t.Object({
	locales: t.Array(
		t.Object({
			code: t.String({ trusted: true }),
			name: t.String({ trusted: true }),
		}),
	),
	current: t.String({ trusted: true }),
	default: t.String({ trusted: true }),
})

export const i18nRoutes = new Elysia({
	name: "module.i18n",
	prefix: "/api/i18n",
	tags: ["i18n"],
})
	.use(sharedModels)
	.use(i18nPlugin)
	.get(
		"/locales",
		({ locale }) =>
			ok(
				{
					locales: availableLocales(),
					current: locale,
					default: env.DEFAULT_LOCALE,
				},
				{ message: translate(locale, "common.success") },
			),
		{
			response: successSchema(localesData),
			detail: {
				summary: "GET Locales available",
			},
		},
	)
