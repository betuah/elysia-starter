import { Elysia, t } from "elysia"

import { ok } from "../../lib/response"
import { sharedModels } from "../../models"
import { successSchema } from "../../models/success"

const healthData = t.Object({
	status: t.Literal("ok"),
	time: t.String({ format: "date-time", trusted: true }),
})

export const health = new Elysia({ name: "module.health", tags: ["Health"] })
	.use(sharedModels)
	.get(
		"/health",
		() =>
			ok({
				status: "ok" as const,
				time: new Date().toISOString(),
			}),
		{
			response: successSchema(healthData),
			detail: { summary: "Liveness probe" },
		},
	)
