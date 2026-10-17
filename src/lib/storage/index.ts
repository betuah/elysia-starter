import path from "node:path"

import { env } from "../../env"
import { LocalStorageAdapter } from "./local"
import { S3StorageAdapter } from "./s3"
import type { StorageAdapter, StorageConfig } from "./types"

export type {
	PresignGetOptions,
	PresignPutOptions,
	PresignedUrlResult,
	PutOptions,
	PutResult,
	StorageAdapter,
	StorageConfig,
	StorageDriver,
	StorageObject,
} from "./types"
export { LocalStorageAdapter } from "./local"
export { buildS3ClientOptions, S3StorageAdapter } from "./s3"

/** Build a storage adapter from an explicit config (useful in tests). */
export function createStorage(config: StorageConfig): StorageAdapter {
	if (config.driver === "local") return new LocalStorageAdapter(config)
	return new S3StorageAdapter(config)
}

/** Resolve `StorageConfig` from `env` (validated at process start). */
export function storageConfigFromEnv(): StorageConfig {
	const prefix = env.STORAGE_PREFIX
	if (env.STORAGE_DRIVER === "local") {
		return {
			driver: "local",
			rootDir: path.resolve(env.STORAGE_LOCAL_DIR),
			prefix,
			publicUrlBase: env.STORAGE_PUBLIC_URL ?? `${env.APP_URL.replace(/\/+$/, "")}/uploads`,
		}
	}

	return {
		driver: "s3",
		endpoint: env.S3_ENDPOINT,
		region: env.S3_REGION,
		accessKeyId: env.S3_ACCESS_KEY_ID!,
		secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
		bucket: env.S3_BUCKET!,
		prefix,
		publicUrlBase: env.S3_PUBLIC_URL ?? env.STORAGE_PUBLIC_URL,
		presignExpires: env.S3_PRESIGN_EXPIRES,
		forcePathStyle: env.S3_FORCE_PATH_STYLE,
	}
}

let singleton: StorageAdapter | undefined

/** Process-wide adapter — same instance for all callers. */
export function getStorage(): StorageAdapter {
	if (!singleton) singleton = createStorage(storageConfigFromEnv())
	return singleton
}

/** Test helper: replace or clear the singleton. */
export function setStorageForTests(adapter: StorageAdapter | undefined): void {
	singleton = adapter
}
