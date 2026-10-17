import path from "node:path"

/** Normalize a storage key: trim slashes, reject `..` and absolute paths. */
export function normalizeKey(key: string): string {
	const trimmed = key.trim().replace(/^\/+/, "").replace(/\\/g, "/")
	if (!trimmed) throw new Error("Storage key must not be empty.")
	const segments = trimmed.split("/").filter((s) => s.length > 0)
	if (segments.some((s) => s === "." || s === "..")) {
		throw new Error("Storage key must not contain path traversal segments.")
	}
	return segments.join("/")
}

/** Join optional prefix with a relative key. */
export function withPrefix(prefix: string, key: string): string {
	const normalizedKey = normalizeKey(key)
	const cleanedPrefix = prefix.trim().replace(/^\/+|\/+$/g, "")
	if (!cleanedPrefix) return normalizedKey
	return `${cleanedPrefix}/${normalizedKey}`
}

/** Safe file extension from an original filename (max 32 chars, alphanumeric + dot). */
export function extensionFromFilename(filename: string | undefined): string {
	if (!filename) return ""
	const ext = path.extname(filename).slice(0, 32)
	if (!ext || !/^\.[a-zA-Z0-9.]+$/.test(ext)) return ""
	return ext.toLowerCase()
}

/** Build `{prefix}{uuid}{ext}` when the caller does not supply a key. */
export function generateKey(prefix: string, filename?: string): string {
	const id = crypto.randomUUID()
	const ext = extensionFromFilename(filename)
	return withPrefix(prefix, `${id}${ext}`)
}

/** Resolve a key under `rootDir`; throws if it escapes the root. */
export function resolveUnderRoot(rootDir: string, key: string): string {
	const normalized = normalizeKey(key)
	const root = path.resolve(rootDir)
	const full = path.resolve(root, normalized)
	if (full !== root && !full.startsWith(root + path.sep)) {
		throw new Error("Storage key resolves outside the configured root.")
	}
	return full
}

export function joinPublicUrl(base: string, key: string): string {
	const normalized = normalizeKey(key)
	const trimmedBase = base.replace(/\/+$/, "")
	return `${trimmedBase}/${normalized.split("/").map(encodeURIComponent).join("/")}`
}

export async function bodyToUint8Array(
	body: Blob | ArrayBuffer | Uint8Array | string | File,
): Promise<Uint8Array> {
	if (typeof body === "string") return new TextEncoder().encode(body)
	if (body instanceof Uint8Array) return body
	if (body instanceof ArrayBuffer) return new Uint8Array(body)
	return new Uint8Array(await body.arrayBuffer())
}

export function inferContentType(
	explicit: string | undefined,
	filename: string | undefined,
	body: Blob | ArrayBuffer | Uint8Array | string | File,
): string | undefined {
	if (explicit) return explicit
	if (typeof File !== "undefined" && body instanceof File && body.type) return body.type
	if (typeof Blob !== "undefined" && body instanceof Blob && body.type) return body.type
	const ext = extensionFromFilename(filename)
	switch (ext) {
		case ".png":
			return "image/png"
		case ".jpg":
		case ".jpeg":
			return "image/jpeg"
		case ".gif":
			return "image/gif"
		case ".webp":
			return "image/webp"
		case ".pdf":
			return "application/pdf"
		case ".json":
			return "application/json"
		case ".txt":
			return "text/plain"
		default:
			return undefined
	}
}
