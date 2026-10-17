import { availableParallelism, cpus } from "node:os"

import type { NodeEnv } from "../env"

/**
 * Resolve how many worker processes to run.
 *
 * - `0` / unset / `false` → single process (default; keeps `bun run dev` and tests simple)
 * - `auto` → `os.availableParallelism()` (fallback: `cpus().length`)
 * - `N` → exactly N workers (N ≥ 1)
 */
export function resolveClusterWorkers(raw: string | undefined): number {
	if (raw === undefined || raw === "" || raw === "0" || raw === "false") return 0
	if (raw === "auto") {
		const n = typeof availableParallelism === "function" ? availableParallelism() : cpus().length
		return Math.max(1, n)
	}
	const value = Number(raw)
	if (!Number.isInteger(value) || value < 0) {
		throw new Error(`CLUSTER_WORKERS must be 0, auto, or a non-negative integer. Received "${raw}".`)
	}
	return value
}

export function warnClusterPlatform(workers: number, platform: NodeJS.Platform = process.platform): void {
	if (workers <= 1) return
	if (platform === "linux") return
	console.warn(
		`[cluster] SO_REUSEPORT multi-process listen is reliable on Linux. On ${platform}, workers may fail with EADDRINUSE — use a process manager + reverse proxy, or run on Linux.`,
	)
}

/**
 * In-memory rate limits are per-process. With multiple workers, each process has its own
 * counters — effective limits scale with worker count. Prefer single process or an external
 * store before recommending cluster in production. See docs/cluster.md and docs/security.md.
 */
export function warnClusterRateLimitMemory(workers: number): void {
	if (workers <= 1) return
	console.warn(
		`[cluster] In-memory rate limiting is per-process (not shared across ${workers} workers). Use CLUSTER_WORKERS=0/1 or an external rate-limit store before production multi-worker deploy.`,
	)
}

/** Cluster stays off unless CLUSTER_WORKERS is set, even in production. */
export function shouldUseCluster(workers: number, _nodeEnv: NodeEnv): boolean {
	return workers > 1
}
