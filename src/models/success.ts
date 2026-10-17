import { t, type TSchema } from "elysia"

/** Uniform success body: `{ code, message, data }`. */
export function successSchema<T extends TSchema>(data: T) {
	return t.Object({
		code: t.String({ trusted: true }),
		message: t.String({ trusted: true }),
		data,
	})
}
