import { describe, expect, it } from "bun:test"

import { resolveClusterWorkers, shouldUseCluster } from "../../src/config/cluster"
import { serveOptions } from "../../src/config/server"

describe("config.cluster", () => {
	it("defaults and parses CLUSTER_WORKERS with availableParallelism for auto", () => {
		expect(resolveClusterWorkers(undefined)).toBe(0)
		expect(resolveClusterWorkers("")).toBe(0)
		expect(resolveClusterWorkers("0")).toBe(0)
		expect(resolveClusterWorkers("false")).toBe(0)
		expect(resolveClusterWorkers("4")).toBe(4)
		expect(resolveClusterWorkers("auto")).toBeGreaterThanOrEqual(1)
		expect(() => resolveClusterWorkers("1.5")).toThrow()
		expect(() => resolveClusterWorkers("-1")).toThrow()
	})

	it("enables cluster only when workers > 1", () => {
		expect(shouldUseCluster(0, "production")).toBe(false)
		expect(shouldUseCluster(1, "production")).toBe(false)
		expect(shouldUseCluster(2, "development")).toBe(true)
	})

	it("keeps reusePort enabled for SO_REUSEPORT", () => {
		expect(serveOptions.reusePort).toBe(true)
	})
})
