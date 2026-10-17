/** Supported storage backends — selected via `STORAGE_DRIVER`. */
export type StorageDriver = "local" | "s3"

export type PutOptions = {
	/** Object key; generated when omitted (`{prefix}{uuid}{ext}`). */
	key?: string
	body: Blob | ArrayBuffer | Uint8Array | string | File
	contentType?: string
	/** Original filename used only to derive an extension when `key` is omitted. */
	filename?: string
}

export type PutResult = {
	key: string
	size: number
	contentType: string | undefined
	/** Public or app-relative download URL (see driver docs). */
	url: string
	/** Absolute filesystem path — local driver only. */
	path?: string
}

export type StorageObject = {
	key: string
	body: Uint8Array
	contentType: string | undefined
	size: number
}

export type PresignPutOptions = {
	/** Seconds until the URL expires. Defaults to `S3_PRESIGN_EXPIRES`. */
	expiresIn?: number
	/** Content-Type the client must send on PUT (signed into the URL). */
	contentType?: string
}

export type PresignGetOptions = {
	/** Seconds until the URL expires. Defaults to `S3_PRESIGN_EXPIRES`. */
	expiresIn?: number
}

export type PresignedUrlResult = {
	url: string
	key: string
	method: "PUT" | "GET"
	expiresIn: number
}

/**
 * Unified file storage port. Modules import `getStorage()` — never branch on local vs S3
 * except when handling `null` from optional presign helpers (S3-only).
 *
 * Two upload flows:
 * 1. **Server-mediated (primary)** — `put()` works for both `local` and `s3`.
 * 2. **Presign (optional, S3 only)** — `createPutPresignedUrl` / `createGetPresignedUrl`;
 *    local returns `null`.
 */
export interface StorageAdapter {
	readonly driver: StorageDriver
	/**
	 * Primary write path for both drivers: local disk (`Bun.write`) or S3 (`S3Client.write`).
	 * Prefer this (or multipart → API → `put`) over client-side presign.
	 */
	put(options: PutOptions): Promise<PutResult>
	get(key: string): Promise<StorageObject | null>
	delete(key: string): Promise<void>
	exists(key: string): Promise<boolean>
	getPublicUrl(key: string): string
	/**
	 * Optional. S3: Bun-native PUT presigned URL (client uploads directly to the bucket).
	 * Local: `null` — use server-side `put()` instead (e.g. `POST /api/users/me/avatar`).
	 */
	createPutPresignedUrl(
		key: string,
		opts?: PresignPutOptions,
	): Promise<PresignedUrlResult | null>
	/**
	 * Optional. S3: Bun-native GET presigned URL (client downloads directly from the bucket).
	 * Local: `null` — use `getPublicUrl()` / `GET /uploads/{key}`.
	 */
	createGetPresignedUrl(
		key: string,
		opts?: PresignGetOptions,
	): Promise<PresignedUrlResult | null>
}

export type LocalStorageConfig = {
	driver: "local"
	/** Absolute or cwd-relative directory for objects. */
	rootDir: string
	/** Optional key prefix (e.g. `uploads/`). */
	prefix: string
	/**
	 * Base URL for `getPublicUrl` (no trailing slash).
	 * Default: `{APP_URL}/uploads`.
	 */
	publicUrlBase: string
}

export type S3StorageConfig = {
	driver: "s3"
	/**
	 * S3-compatible API base URL (MinIO, Wasabi, RustFS, R2, …).
	 * Omit / leave empty for AWS default (Bun infers from `region` + `bucket`).
	 */
	endpoint: string | undefined
	region: string
	accessKeyId: string
	secretAccessKey: string
	bucket: string
	prefix: string
	/**
	 * CDN / public bucket base (no trailing slash).
	 * When unset, `getPublicUrl` returns a short-lived Bun presigned URL.
	 */
	publicUrlBase: string | undefined
	/** Default expiry for `create*PresignedUrl` and fallback `getPublicUrl` (seconds). */
	presignExpires: number
	/**
	 * Prefer path-style URLs (`endpoint/bucket/key`) — typical for MinIO / RustFS / many
	 * self-hosted APIs. Maps to Bun `virtualHostedStyle: !forcePathStyle`.
	 * `undefined` leaves Bun’s default (`virtualHostedStyle: false` = path-style).
	 */
	forcePathStyle: boolean | undefined
}

export type StorageConfig = LocalStorageConfig | S3StorageConfig
