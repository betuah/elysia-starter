import { mkdir } from "node:fs/promises"
import path from "node:path"

import {
	bodyToUint8Array,
	generateKey,
	inferContentType,
	joinPublicUrl,
	normalizeKey,
	resolveUnderRoot,
	withPrefix,
} from "./keys"
import type {
	LocalStorageConfig,
	PresignGetOptions,
	PresignPutOptions,
	PresignedUrlResult,
	PutOptions,
	PutResult,
	StorageAdapter,
	StorageObject,
} from "./types"

export class LocalStorageAdapter implements StorageAdapter {
	readonly driver = "local" as const

	constructor(private readonly config: LocalStorageConfig) {}

	async put(options: PutOptions): Promise<PutResult> {
		const key = options.key
			? withPrefix(this.config.prefix, options.key)
			: generateKey(this.config.prefix, options.filename)
		const contentType = inferContentType(options.contentType, options.filename, options.body)
		const bytes = await bodyToUint8Array(options.body)
		const fullPath = resolveUnderRoot(this.config.rootDir, key)
		await mkdir(path.dirname(fullPath), { recursive: true })

		const file = Bun.file(fullPath)
		await Bun.write(file, bytes)

		// Sidecar content-type when Bun.file().type is unreliable for custom extensions.
		if (contentType) {
			await Bun.write(`${fullPath}.content-type`, contentType)
		}

		return {
			key,
			size: bytes.byteLength,
			contentType,
			url: this.getPublicUrl(key),
			path: fullPath,
		}
	}

	async get(key: string): Promise<StorageObject | null> {
		const normalized = normalizeKey(key)
		const fullPath = resolveUnderRoot(this.config.rootDir, normalized)
		const file = Bun.file(fullPath)
		if (!(await file.exists())) return null

		const bytes = new Uint8Array(await file.arrayBuffer())
		const sidecar = Bun.file(`${fullPath}.content-type`)
		let contentType: string | undefined = file.type || undefined
		if (await sidecar.exists()) {
			contentType = (await sidecar.text()).trim() || contentType
		}

		return {
			key: normalized,
			body: bytes,
			contentType,
			size: bytes.byteLength,
		}
	}

	async delete(key: string): Promise<void> {
		const normalized = normalizeKey(key)
		const fullPath = resolveUnderRoot(this.config.rootDir, normalized)
		const file = Bun.file(fullPath)
		if (await file.exists()) await file.delete()
		const sidecar = Bun.file(`${fullPath}.content-type`)
		if (await sidecar.exists()) await sidecar.delete()
	}

	async exists(key: string): Promise<boolean> {
		const fullPath = resolveUnderRoot(this.config.rootDir, normalizeKey(key))
		return Bun.file(fullPath).exists()
	}

	getPublicUrl(key: string): string {
		return joinPublicUrl(this.config.publicUrlBase, key)
	}

	/** Optional presign unsupported on local — callers should use server-side `put()`. */
	async createPutPresignedUrl(
		_key: string,
		_opts?: PresignPutOptions,
	): Promise<PresignedUrlResult | null> {
		return null
	}

	/** Optional presign unsupported on local — use `getPublicUrl()` / `GET /uploads/{key}`. */
	async createGetPresignedUrl(
		_key: string,
		_opts?: PresignGetOptions,
	): Promise<PresignedUrlResult | null> {
		return null
	}
}
