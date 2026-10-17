import { S3Client, type S3Options } from "bun"

import {
	bodyToUint8Array,
	generateKey,
	inferContentType,
	joinPublicUrl,
	normalizeKey,
	withPrefix,
} from "./keys"
import type {
	PresignGetOptions,
	PresignPutOptions,
	PresignedUrlResult,
	PutOptions,
	PutResult,
	S3StorageConfig,
	StorageAdapter,
	StorageObject,
} from "./types"

/**
 * Map app config → Bun `S3Client` / `S3Options`.
 * Provider-agnostic: any S3-compatible API is selected via `endpoint` (+ optional path style).
 *
 * Bun has no `forcePathStyle`; path-style is the default (`virtualHostedStyle: false`).
 * `forcePathStyle: false` opts into virtual-hosted URLs (`bucket.endpoint/...`).
 */
export function buildS3ClientOptions(
	config: Pick<
		S3StorageConfig,
		| "accessKeyId"
		| "secretAccessKey"
		| "bucket"
		| "region"
		| "endpoint"
		| "forcePathStyle"
	>,
): S3Options {
	const options: S3Options = {
		accessKeyId: config.accessKeyId,
		secretAccessKey: config.secretAccessKey,
		bucket: config.bucket,
		region: config.region,
	}
	if (config.endpoint) options.endpoint = config.endpoint
	if (config.forcePathStyle !== undefined) {
		options.virtualHostedStyle = !config.forcePathStyle
	}
	return options
}

export class S3StorageAdapter implements StorageAdapter {
	readonly driver = "s3" as const
	private readonly client: S3Client

	constructor(private readonly config: S3StorageConfig) {
		this.client = new S3Client(buildS3ClientOptions(config))
	}

	async put(options: PutOptions): Promise<PutResult> {
		const key = options.key
			? withPrefix(this.config.prefix, options.key)
			: generateKey(this.config.prefix, options.filename)
		const contentType = inferContentType(options.contentType, options.filename, options.body)
		const bytes = await bodyToUint8Array(options.body)

		if (contentType) {
			await this.client.write(key, bytes, { type: contentType })
		} else {
			await this.client.write(key, bytes)
		}

		return {
			key,
			size: bytes.byteLength,
			contentType,
			url: this.getPublicUrl(key),
		}
	}

	async get(key: string): Promise<StorageObject | null> {
		const normalized = normalizeKey(key)
		const file = this.client.file(normalized)
		if (!(await file.exists())) return null

		const bytes = new Uint8Array(await file.arrayBuffer())
		const contentType = file.type || undefined

		return {
			key: normalized,
			body: bytes,
			contentType,
			size: bytes.byteLength,
		}
	}

	async delete(key: string): Promise<void> {
		await this.client.delete(normalizeKey(key))
	}

	async exists(key: string): Promise<boolean> {
		return this.client.exists(normalizeKey(key))
	}

	getPublicUrl(key: string): string {
		const normalized = normalizeKey(key)
		if (this.config.publicUrlBase) {
			return joinPublicUrl(this.config.publicUrlBase, normalized)
		}
		return this.client.presign(normalized, { expiresIn: this.config.presignExpires })
	}

	async createPutPresignedUrl(
		key: string,
		opts?: PresignPutOptions,
	): Promise<PresignedUrlResult> {
		const fullKey = withPrefix(this.config.prefix, key)
		const expiresIn = opts?.expiresIn ?? this.config.presignExpires
		const url = this.client.presign(fullKey, {
			expiresIn,
			method: "PUT",
			...(opts?.contentType ? { type: opts.contentType } : {}),
		})
		return { url, key: fullKey, method: "PUT", expiresIn }
	}

	async createGetPresignedUrl(
		key: string,
		opts?: PresignGetOptions,
	): Promise<PresignedUrlResult> {
		/** Use the stored key from `put` / `createPutPresignedUrl` (prefix already applied). */
		const fullKey = normalizeKey(key)
		const expiresIn = opts?.expiresIn ?? this.config.presignExpires
		const url = this.client.presign(fullKey, {
			expiresIn,
			method: "GET",
		})
		return { url, key: fullKey, method: "GET", expiresIn }
	}
}
