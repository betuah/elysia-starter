import { describe, expect, it } from "bun:test"
import { Elysia, t } from "elysia"

import { elysiaOptions, serveOptions } from "../../src/config/server"
import { env } from "../../src/env"

describe("config.server", () => {
	it("maps env limits into Bun serve options and Elysia constructor config", () => {
		expect(serveOptions.maxRequestBodySize).toBe(env.MAX_BODY_SIZE)
		expect(serveOptions.idleTimeout).toBe(env.IDLE_TIMEOUT)
		expect(serveOptions.reusePort).toBe(true)
		expect(elysiaOptions.serve).toEqual(serveOptions)
		expect(Array.isArray(elysiaOptions.sanitize)).toBe(true)

		const instance = new Elysia(elysiaOptions)
		expect(instance.config.serve?.maxRequestBodySize).toBe(env.MAX_BODY_SIZE)
		expect(instance.config.serve?.idleTimeout).toBe(env.IDLE_TIMEOUT)
	})

	it("escapes non-trusted input strings and leaves trusted fields alone", async () => {
		const app = new Elysia(elysiaOptions).post("/echo", ({ body }) => body, {
			body: t.Object({
				name: t.String(),
				password: t.String({ trusted: true }),
			}),
			response: t.Object({
				name: t.String({ trusted: true }),
				password: t.String({ trusted: true }),
			}),
		})

		const res = await app.handle(
			new Request("http://localhost/echo", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ name: "a&b<script>", password: "P@ss&Word1!" }),
			}),
		)
		expect(res.status).toBe(200)
		expect(await res.json()).toEqual({
			name: "a&amp;b&lt;script&gt;",
			password: "P@ss&Word1!",
		})
	})
})
