/**
 * Response helpers — DTO shape + pagination, not HTML escaping.
 *
 * Elysia `sanitize` (Bun.escapeHTML) is for validated **inputs**. API JSON responses
 * stay raw text for React clients; omit secrets via public mappers (e.g. toPublicUser).
 */

export type PageParams = {
	limit: number
	offset: number
}

/** Build a list payload: `{ items, total, limit, offset }`. */
export function paginated<T>(items: T[], total: number, query: PageParams) {
	return {
		items,
		total,
		limit: query.limit,
		offset: query.offset,
	}
}

export type Paginated<T> = ReturnType<typeof paginated<T>>
