import { Elysia, t } from "elysia"

import { env } from "../../env"
import { availableLocales } from "../../i18n"
import { sharedModels } from "../../models"
import { i18nPlugin } from "../../plugins/i18n"

export const i18nRoutes = new Elysia({
	name: "module.i18n",
	prefix: "/api/i18n",
	tags: ["i18n"],
})
	.use(sharedModels)
	.use(i18nPlugin)
	.get(
		"/locales",
		({ locale }) => ({
			locales: availableLocales(),
			current: locale,
			default: env.DEFAULT_LOCALE,
		}),
		{
			response: t.Object({
				locales: t.Array(
					t.Object({
						code: t.String(),
						name: t.String({ trusted: true }),
					}),
				),
				current: t.String(),
				default: t.String(),
			}),
			detail: {
				summary: "Available locales and current negotiation result",
			},
		},
	)
