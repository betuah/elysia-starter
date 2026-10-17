/**
 * Entry — cluster primary or single process.
 *
 * Official Elysia pattern (https://elysiajs.com/patterns/deploy.html):
 *   primary forks workers with node:cluster; each worker `await import('./server')`.
 *
 * Starter toggle: CLUSTER_WORKERS=0 keeps a single process (dev/test default).
 * When cluster is on, control flow matches the docs; we also migrate once on primary.
 *
 * Tip (docs): Bun uses SO_REUSEPORT by default — multiple listeners on one port.
 * That only works reliably on Linux.
 *
 * Cron: with CRON_ENABLED, the primary starts `./cron-runner` after forking (not on workers).
 * See README “Cron + Cluster” and `src/config/cron.ts`.
 */
import cluster from "node:cluster"
import process from "node:process"

import {
	resolveClusterWorkers,
	shouldUseCluster,
	warnClusterPlatform,
	warnClusterRateLimitMemory,
} from "./config/cluster"
import { shouldRunCronOnPrimary } from "./config/cron"
import { env } from "./env"

const workers = resolveClusterWorkers(env.CLUSTER_WORKERS)
const clustered = shouldUseCluster(workers, env.NODE_ENV)

if (clustered && cluster.isPrimary) {
	warnClusterPlatform(workers)
	warnClusterRateLimitMemory(workers, env.RATE_LIMIT_ENABLED)

	// Not in the docs sample — starter needs one migrate before workers open the DB.
	if (env.RUN_MIGRATIONS) {
		const { runBootMigrations } = await import("./db/migrate")
		await runBootMigrations()
		console.log(`[cluster] migrations applied (primary ${process.pid})`)
	}

	console.log(`[cluster] primary ${process.pid} starting ${workers} workers`)
	for (let i = 0; i < workers; i++) {
		cluster.fork({ RUN_MIGRATIONS: "false" })
	}

	cluster.on("exit", (worker, code, signal) => {
		const reason = signal ?? code
		console.error(`[cluster] worker ${worker.process.pid} exited (${reason})`)
	})

	// Pattern A: cron on primary only — never duplicate jobs across workers.
	if (
		shouldRunCronOnPrimary({
			cronEnabled: env.CRON_ENABLED,
			clustered: true,
			isPrimary: true,
		})
	) {
		await import("./cron-runner")
	}
} else {
	await import("./server")
	if (cluster.worker) {
		console.log(`[cluster] worker ${process.pid} started`)
	}
}
