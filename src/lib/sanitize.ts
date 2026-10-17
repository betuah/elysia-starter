/**
 * Service-level string cleaning (trim / NUL / optional tag strip).
 *
 * Primary HTML escape for validated inputs: Elysia `sanitize` in `src/config/server.ts`
 * (`Bun.escapeHTML`). Do not call `escapeHtml` again on the same write path.
 *
 * Never run these on passwords. HTML escape does **not** make a leaked secret safe.
 */

export type SanitizeTextOptions = {
	/** Collapse runs of whitespace to a single space (good for titles). Default: true */
	collapseWhitespace?: boolean
	/**
	 * Remove HTML tags. Default: false — framework `Bun.escapeHTML` already neutralizes
	 * markup on validated inputs; stripping after escape would leave entities as text.
	 */
	stripHtml?: boolean
}

/** Remove NUL bytes that can break storage or downstream parsers. */
export function stripNullBytes(value: string): string {
	return value.replace(/\0/g, "")
}

/** Trim and collapse any whitespace run to a single space. */
export function collapseWhitespace(value: string): string {
	return value.trim().replace(/\s+/g, " ")
}

/** Strip HTML tags; leaves text content. Not a full XSS HTML sanitizer. */
export function stripHtml(value: string): string {
	return value.replace(/<\/?[^>]+>/g, "")
}

/** Escape `& < > " '` for safe HTML embedding when you must keep markup-looking text. */
export function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;")
}

/**
 * Clean a single-line / short user string (titles, names, labels).
 * Order: null bytes → optional HTML strip → optional whitespace collapse → trim.
 * Does not call `escapeHtml` — Elysia `sanitize` owns that for validated routes.
 */
export function sanitizeText(value: string, options: SanitizeTextOptions = {}): string {
	const { collapseWhitespace: collapse = true, stripHtml: removeHtml = false } = options
	let next = stripNullBytes(value)
	if (removeHtml) next = stripHtml(next)
	if (collapse) next = collapseWhitespace(next)
	else next = next.trim()
	return next
}

/**
 * Clean multiline body text: strip null bytes, normalize newlines,
 * collapse horizontal whitespace per line, trim edges. Preserves paragraph breaks.
 * Pass `{ stripHtml: true }` via composing with `stripHtml` when needed; default leaves
 * markup for framework escapeHTML (or your own call).
 */
export function sanitizeMultiline(value: string, options: { stripHtml?: boolean } = {}): string {
	const { stripHtml: removeHtml = false } = options
	let next = stripNullBytes(value)
	if (removeHtml) next = stripHtml(next)
	return next
		.replace(/\r\n?/g, "\n")
		.split("\n")
		.map((line) => line.replace(/[^\S\n]+/g, " ").trim())
		.join("\n")
		.replace(/\n{3,}/g, "\n\n")
		.trim()
}
