/**
 * OpenAPI / Scalar docs gate.
 *
 * - `DOCS_ENABLED` unset → on unless `NODE_ENV=production`
 * - Explicit `true`/`false` (or `1`/`0`) wins
 * - When off: Elysia `/docs` is not mounted; Better Auth openAPI plugin is omitted
 * - Optional HTTP Basic Auth when both `DOCS_BASIC_AUTH_USER` + `DOCS_BASIC_AUTH_PASSWORD` are set
 */

export type ResolveDocsEnabledInput = {
	/** Parsed `DOCS_ENABLED` — unset → `undefined` */
	docsEnabled?: boolean | undefined
	nodeEnv: "development" | "test" | "production"
}

export function resolveDocsEnabled(input: ResolveDocsEnabledInput): boolean {
	if (input.docsEnabled !== undefined) return input.docsEnabled
	return input.nodeEnv !== "production"
}

export function isDocsBasicAuthConfigured(
	user: string | undefined,
	password: string | undefined,
): boolean {
	return Boolean(user && password)
}

/** Paths that expose API schemas / Scalar UIs when docs are enabled. */
export function docsPathRequiresAuth(pathname: string): boolean {
	return (
		/^\/docs(?:\/|$)/.test(pathname) ||
		/^\/api\/auth\/reference(?:\/|$)/.test(pathname) ||
		/^\/api\/auth\/open-api(?:\/|$)/.test(pathname)
	)
}

/**
 * Validate `Authorization: Basic …` against docs credentials.
 * Uses timing-safe compare when lengths match.
 */
export function authorizeDocsBasicAuth(
	authorizationHeader: string | null | undefined,
	user: string,
	password: string,
): boolean {
	if (!authorizationHeader?.startsWith("Basic ")) return false
	const encoded = authorizationHeader.slice("Basic ".length).trim()
	if (!encoded) return false

	let decoded: string
	try {
		decoded = atob(encoded)
	} catch {
		return false
	}

	const colon = decoded.indexOf(":")
	if (colon < 0) return false
	const providedUser = decoded.slice(0, colon)
	const providedPassword = decoded.slice(colon + 1)

	return timingSafeEqualString(providedUser, user) && timingSafeEqualString(providedPassword, password)
}

function timingSafeEqualString(a: string, b: string): boolean {
	const left = Buffer.from(a)
	const right = Buffer.from(b)
	if (left.length !== right.length) {
		// Still compare to avoid leaking length via early return timing alone.
		const padded = Buffer.alloc(left.length)
		right.copy(padded, 0, 0, Math.min(right.length, left.length))
		crypto.timingSafeEqual(left, padded)
		return false
	}
	return crypto.timingSafeEqual(left, right)
}
