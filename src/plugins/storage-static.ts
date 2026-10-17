import { Elysia } from "elysia"

import type { Locale } from "../i18n"
import { failT } from "../lib/error"
import { getStorage } from "../lib/storage"
import { normalizeKey } from "../lib/storage/keys"
import { sharedModels } from "../models"
import { i18nPlugin } from "./i18n"

/**
 * Serve-only HTTP surface for the local storage driver.
 * Public URLs from `getStorage().getPublicUrl()` / `put()` default to
 * `{APP_URL}/uploads/{key}` — this plugin answers those GETs.
 *
 * Upload / delete / presign stay in modules via `getStorage()` (no CRUD HTTP here).
 */
export const storageStatic = new Elysia({
	name: "plugin.storage-static",
	prefix: "/uploads",
	tags: ["System"],
	detail: {
		description:
			"Local storage public fetch. Object keys match `getStorage().put()` / `getPublicUrl()`. " +
			"Not used when objects are served from S3/CDN (`STORAGE_DRIVER=s3`).",
	},
})
	.use(sharedModels)
	.use(i18nPlugin)
	.get(
		"/*",
		({ params, locale }) => download(params["*"], locale),
		{
			response: {
				400: "common.Error",
				404: "common.Error",
			},
			detail: {
				summary: "Serve a local stored object by key",
				description:
					"Path after `/uploads/` is the storage key. Used by local `getPublicUrl` targets.",
			},
		},
	)

async function download(rawKey: string, locale: Locale) {
	const key = parseKey(rawKey, locale)
	const object = await getStorage().get(key)
	if (!object) failT(locale, 404, "NOT_FOUND", "errors.fileNotFound")

	const contentType = object.contentType ?? "application/octet-stream"
	return new Response(Buffer.from(object.body), {
		headers: {
			"content-type": contentType,
			"content-length": String(object.size),
			"cache-control": "public, max-age=3600",
		},
	})
}

function parseKey(rawKey: string, locale: Locale): string {
	try {
		return normalizeKey(rawKey)
	} catch {
		failT(locale, 400, "VALIDATION", "errors.fileInvalidKey")
	}
}
