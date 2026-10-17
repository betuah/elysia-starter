/**
 * Uniform API response envelopes for Elysia modules (not Better Auth mount).
 *
 * Success: `{ code, message, data }`
 * List data: `{ items, meta: { page, pageSize, total, totalPages } }`
 * Errors stay `{ code, message }` via `fail` / error plugin — no `data`.
 * Schema validation may also include `errors: { field, message }[]`.
 *
 * Elysia `sanitize` (Bun.escapeHTML) is for validated **inputs**. API JSON responses
 * stay raw text for React clients; omit secrets via public mappers (e.g. toPublicUser).
 */

export type SuccessOpts = {
	code?: string
	message?: string
}

export type PageParams = {
	page: number
	pageSize: number
}

export type PageMeta = PageParams & {
	total: number
	totalPages: number
}

export type ListData<T> = {
	items: T[]
	meta: PageMeta
}

export type SuccessEnvelope<T> = {
	code: string
	message: string
	data: T
}

const DEFAULT_CODE = "OK"
const DEFAULT_MESSAGE = "Success"

/** Success envelope: `{ code, message, data }`. */
export function ok<T>(data: T, opts?: SuccessOpts): SuccessEnvelope<T> {
	return {
		code: opts?.code ?? DEFAULT_CODE,
		message: opts?.message ?? DEFAULT_MESSAGE,
		data,
	}
}

/** Success envelope whose `data` is a paginated list `{ items, meta }`. */
export function okList<T>(
	items: T[],
	meta: PageMeta,
	opts?: SuccessOpts,
): SuccessEnvelope<ListData<T>> {
	return ok({ items, meta }, opts)
}

/** Compute `meta` from total + page/pageSize, then return a list success envelope. */
export function paginatedPage<T>(
	items: T[],
	total: number,
	query: PageParams,
	opts?: SuccessOpts,
): SuccessEnvelope<ListData<T>> {
	const page = Math.max(1, query.page)
	const pageSize = Math.max(1, query.pageSize)
	const totalPages = pageSize > 0 ? Math.ceil(total / pageSize) : 0

	return okList(
		items,
		{
			page,
			pageSize,
			total,
			totalPages,
		},
		opts,
	)
}

/** Convert 1-based page/pageSize to limit/offset for repositories. */
export function toLimitOffset(query: PageParams): { limit: number; offset: number } {
	const page = Math.max(1, query.page)
	const pageSize = Math.max(1, query.pageSize)
	return {
		limit: pageSize,
		offset: (page - 1) * pageSize,
	}
}

export type PaginatedPage<T> = ReturnType<typeof paginatedPage<T>>
