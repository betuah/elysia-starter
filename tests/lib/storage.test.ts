import { afterAll, describe, expect, it } from "bun:test"
import { S3Client } from "bun"
import { rm } from "node:fs/promises"
import path from "node:path"

import { buildS3ClientOptions, createStorage } from "../../src/lib/storage"
import { normalizeKey, withPrefix } from "../../src/lib/storage/keys"

const rootDir = path.join(
	process.env.TMPDIR ?? "/tmp",
	`elysia-storage-unit-${crypto.randomUUID()}`,
)

describe("lib.storage", () => {
	afterAll(async () => {
		await rm(rootDir, { recursive: true, force: true })
	})

	it("normalizes keys and rejects traversal", () => {
		expect(normalizeKey("/a/b")).toBe("a/b")
		expect(withPrefix("uploads", "x.png")).toBe("uploads/x.png")
		expect(() => normalizeKey("../secret")).toThrow()
		expect(() => normalizeKey("a/../../b")).toThrow()
	})

	it("local adapter put/get/exists/delete/getPublicUrl", async () => {
		const storage = createStorage({
			driver: "local",
			rootDir,
			prefix: "uploads",
			publicUrlBase: "http://localhost:3000/uploads",
		})

		const put = await storage.put({
			body: "hello storage",
			filename: "note.txt",
			contentType: "text/plain",
		})
		expect(put.key.startsWith("uploads/")).toBe(true)
		expect(put.key.endsWith(".txt")).toBe(true)
		expect(put.size).toBe(13)
		expect(put.url).toBe(`http://localhost:3000/uploads/${put.key}`)
		expect(put.path).toBeTruthy()
		expect(await storage.exists(put.key)).toBe(true)

		const got = await storage.get(put.key)
		expect(got).not.toBeNull()
		expect(new TextDecoder().decode(got!.body)).toBe("hello storage")
		expect(got!.contentType).toBe("text/plain")

		await storage.delete(put.key)
		expect(await storage.exists(put.key)).toBe(false)
		expect(await storage.get(put.key)).toBeNull()
	})

	it("local adapter respects explicit keys under prefix", async () => {
		const storage = createStorage({
			driver: "local",
			rootDir,
			prefix: "uploads",
			publicUrlBase: "http://localhost:3000/uploads",
		})
		const put = await storage.put({
			key: "avatars/me.png",
			body: new Uint8Array([1, 2, 3]),
			contentType: "image/png",
		})
		expect(put.key).toBe("uploads/avatars/me.png")
		expect(await storage.exists(put.key)).toBe(true)
		await storage.delete(put.key)
	})

	it("local adapter returns null for put/get presign (unsupported)", async () => {
		const storage = createStorage({
			driver: "local",
			rootDir,
			prefix: "uploads",
			publicUrlBase: "http://localhost:3000/uploads",
		})
		expect(await storage.createPutPresignedUrl("avatars/x.png")).toBeNull()
		expect(await storage.createGetPresignedUrl("uploads/avatars/x.png")).toBeNull()
	})

	it("buildS3ClientOptions accepts custom endpoint (MinIO-style path)", () => {
		const options = buildS3ClientOptions({
			accessKeyId: "minioadmin",
			secretAccessKey: "minioadmin",
			bucket: "demo",
			region: "us-east-1",
			endpoint: "http://localhost:9000",
			forcePathStyle: true,
		})
		expect(options.endpoint).toBe("http://localhost:9000")
		expect(options.region).toBe("us-east-1")
		expect(options.bucket).toBe("demo")
		expect(options.virtualHostedStyle).toBe(false)

		const client = new S3Client(options)
		const putUrl = client.presign("uploads/a.bin", { expiresIn: 60, method: "PUT" })
		expect(putUrl.startsWith("http://localhost:9000/demo/uploads/a.bin?")).toBe(true)
		expect(putUrl).toContain("X-Amz-Signature=")
	})

	it("buildS3ClientOptions omits endpoint for AWS default and maps forcePathStyle false", () => {
		const options = buildS3ClientOptions({
			accessKeyId: "AKIAEXAMPLE",
			secretAccessKey: "secret",
			bucket: "my-bucket",
			region: "ap-southeast-1",
			endpoint: undefined,
			forcePathStyle: false,
		})
		expect(options.endpoint).toBeUndefined()
		expect(options.virtualHostedStyle).toBe(true)

		const client = new S3Client(options)
		const getUrl = client.presign("x.txt", { expiresIn: 60, method: "GET" })
		expect(getUrl).toContain("amazonaws.com")
		expect(getUrl).toContain("X-Amz-Signature=")
	})

	it("buildS3ClientOptions leaves virtualHostedStyle unset when forcePathStyle is undefined", () => {
		const options = buildS3ClientOptions({
			accessKeyId: "key",
			secretAccessKey: "secret",
			bucket: "bucket",
			region: "us-east-1",
			endpoint: "https://s3.wasabisys.com",
			forcePathStyle: undefined,
		})
		expect(options.endpoint).toBe("https://s3.wasabisys.com")
		expect(options.virtualHostedStyle).toBeUndefined()
	})

	it("S3 adapter createPut/GetPresignedUrl use configured endpoint (no live network)", async () => {
		const storage = createStorage({
			driver: "s3",
			endpoint: "http://127.0.0.1:9000",
			region: "us-east-1",
			accessKeyId: "rustfs",
			secretAccessKey: "rustfssecret",
			bucket: "app",
			prefix: "uploads",
			publicUrlBase: "https://cdn.example.com",
			presignExpires: 900,
			forcePathStyle: true,
		})

		const put = await storage.createPutPresignedUrl("client.bin", {
			contentType: "application/octet-stream",
			expiresIn: 120,
		})
		expect(put).not.toBeNull()
		expect(put!.key).toBe("uploads/client.bin")
		expect(put!.method).toBe("PUT")
		expect(put!.expiresIn).toBe(120)
		expect(put!.url.startsWith("http://127.0.0.1:9000/app/uploads/client.bin?")).toBe(true)

		const get = await storage.createGetPresignedUrl("uploads/client.bin")
		expect(get).not.toBeNull()
		expect(get!.method).toBe("GET")
		expect(get!.url.startsWith("http://127.0.0.1:9000/app/uploads/client.bin?")).toBe(true)
		expect(storage.getPublicUrl("uploads/client.bin")).toBe(
			"https://cdn.example.com/uploads/client.bin",
		)
	})
})
