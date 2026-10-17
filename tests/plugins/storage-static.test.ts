import { afterAll, describe, expect, it } from "bun:test"
import { rm } from "node:fs/promises"

import { app } from "../../src/app"
import { createStorage, setStorageForTests } from "../../src/lib/storage"
import { origin } from "../helpers/http"

describe("plugin.storage-static", () => {
	afterAll(async () => {
		setStorageForTests(undefined)
		const dir = process.env.STORAGE_LOCAL_DIR
		if (dir) await rm(dir, { recursive: true, force: true })
	})

	it("serves a file by key after put via shared storage", async () => {
		const storage = createStorage({
			driver: "local",
			rootDir: process.env.STORAGE_LOCAL_DIR!,
			prefix: process.env.STORAGE_PREFIX ?? "",
			publicUrlBase: `${origin}/uploads`,
		})
		setStorageForTests(storage)

		const put = await storage.put({
			body: "hello uploads",
			filename: "hello.txt",
			contentType: "text/plain",
		})

		expect(put.url).toBe(`${origin}/uploads/${put.key}`)

		const dl = await app.handle(new Request(`${origin}/uploads/${put.key}`))
		expect(dl.status).toBe(200)
		expect(await dl.text()).toBe("hello uploads")
		expect(dl.headers.get("content-type")).toContain("text/plain")
	})

	it("returns 404 for missing keys", async () => {
		const storage = createStorage({
			driver: "local",
			rootDir: process.env.STORAGE_LOCAL_DIR!,
			prefix: process.env.STORAGE_PREFIX ?? "",
			publicUrlBase: `${origin}/uploads`,
		})
		setStorageForTests(storage)

		const res = await app.handle(new Request(`${origin}/uploads/missing/nope.txt`))
		expect(res.status).toBe(404)
	})
})
