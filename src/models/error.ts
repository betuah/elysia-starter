import { t } from "elysia"

import { errorCodes } from "../lib/error"

/** Per-field entry for schema / request validation failures. */
export const fieldErrorModel = t.Object({
	field: t.String({ trusted: true }),
	message: t.String({ trusted: true }),
})

export const errorModel = t.Object({
	code: t.Union(errorCodes.map((code) => t.Literal(code))),
	message: t.String({ trusted: true }),
	errors: t.Optional(t.Array(fieldErrorModel)),
})
