import { t, type TSchema } from "elysia"

/** Shared list query: `?page=&pageSize=`. */
export const pageQuery = t.Object({
	page: t.Optional(t.Numeric({ minimum: 1, default: 1 })),
	pageSize: t.Optional(t.Numeric({ minimum: 1, maximum: 100, default: 20 })),
})

/** Meta fields shared by every paginated list `data`. */
export const pageMeta = t.Object({
	page: t.Number(),
	pageSize: t.Number(),
	total: t.Number(),
	totalPages: t.Number(),
})

/** List payload inside success `data`: `{ items: T[], meta }`. */
export function paginatedDataSchema<T extends TSchema>(item: T) {
	return t.Object({
		items: t.Array(item),
		meta: pageMeta,
	})
}
