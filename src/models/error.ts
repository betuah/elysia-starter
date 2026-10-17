import { t } from "elysia"

import { errorCodes } from "../lib/error"

export const errorModel = t.Object({
	code: t.Union(errorCodes.map((code) => t.Literal(code))),
	message: t.String({ trusted: true }),
})
