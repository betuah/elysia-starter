import { t, type TSchema } from "elysia"

/** Shared list query: `?limit=&offset=`. */
export const pageQuery = t.Object({
	limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100, default: 20 })),
	offset: t.Optional(t.Numeric({ minimum: 0, default: 0 })),
})

/** Meta fields shared by every paginated list body. */
export const pageMeta = t.Object({
	total: t.Number(),
	limit: t.Number(),
	offset: t.Number(),
})

/** `{ items: T[], total, limit, offset }` for a given item schema. */
export function paginatedSchema<T extends TSchema>(item: T) {
	return t.Object({
		items: t.Array(item),
		total: t.Number(),
		limit: t.Number(),
		offset: t.Number(),
	})
}
