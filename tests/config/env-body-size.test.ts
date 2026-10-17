import { describe, expect, it } from "bun:test"

import { isRateLimitEnabled, resolveMaxBodySizeBytes } from "../../src/env"

describe("env body size + rate limit flags", () => {
	it("defaults to 1 MiB when neither body-size env is set", () => {
		expect(resolveMaxBodySizeBytes({})).toBe(1_048_576)
	})

	it("parses MAX_BODY_SIZE_MIB to bytes", () => {
		expect(resolveMaxBodySizeBytes({ MAX_BODY_SIZE_MIB: "2" })).toBe(2_097_152)
		expect(resolveMaxBodySizeBytes({ MAX_BODY_SIZE_MIB: "128" })).toBe(134_217_728)
	})

	it("prefers MAX_BODY_SIZE_MIB over legacy MAX_BODY_SIZE", () => {
		expect(
			resolveMaxBodySizeBytes({
				MAX_BODY_SIZE_MIB: "2",
				MAX_BODY_SIZE: "1048576",
			}),
		).toBe(2_097_152)
	})

	it("falls back to legacy MAX_BODY_SIZE bytes", () => {
		expect(resolveMaxBodySizeBytes({ MAX_BODY_SIZE: "2097152" })).toBe(2_097_152)
	})

	it("rejects invalid MiB / byte values", () => {
		expect(() => resolveMaxBodySizeBytes({ MAX_BODY_SIZE_MIB: "0" })).toThrow(/MAX_BODY_SIZE_MIB/)
		expect(() => resolveMaxBodySizeBytes({ MAX_BODY_SIZE_MIB: "1.5" })).toThrow(/MAX_BODY_SIZE_MIB/)
		expect(() => resolveMaxBodySizeBytes({ MAX_BODY_SIZE: "0" })).toThrow(/MAX_BODY_SIZE/)
	})

	it("treats RATE_LIMIT_ENABLED unset as disabled", () => {
		const prev = process.env.RATE_LIMIT_ENABLED
		delete process.env.RATE_LIMIT_ENABLED
		expect(isRateLimitEnabled()).toBe(false)
		process.env.RATE_LIMIT_ENABLED = "true"
		expect(isRateLimitEnabled()).toBe(true)
		process.env.RATE_LIMIT_ENABLED = "false"
		expect(isRateLimitEnabled()).toBe(false)
		if (prev === undefined) delete process.env.RATE_LIMIT_ENABLED
		else process.env.RATE_LIMIT_ENABLED = prev
	})
})
