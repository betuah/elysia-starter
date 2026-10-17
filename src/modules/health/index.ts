import { Elysia, t } from "elysia"

import { sharedModels } from "../../models"

export const health = new Elysia({ name: "module.health", tags: ["Health"] })
	.use(sharedModels)
	.get(
		"/health",
		() => ({ status: "ok" as const, time: new Date().toISOString() }),
		{
			response: t.Object({
				status: t.Literal("ok"),
				time: t.String({ format: "date-time" }),
			}),
			detail: { summary: "Liveness probe" },
		},
	)
