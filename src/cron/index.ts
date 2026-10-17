import { Elysia } from "elysia"

import { heartbeatJob } from "./heartbeat"

/**
 * Registers all scheduled jobs into one Elysia plugin.
 *
 * To add a job:
 * 1. Create `src/cron/<name>.ts` exporting a `*Job()` that returns `cron({ ... })`
 * 2. Import it here and `.use(yourJob())`
 *
 * Register only when `shouldRunCron` / `shouldAttachCronToHttpApp` says so —
 * never mount this on every cluster worker.
 */
export function createCronPlugin() {
	return new Elysia({ name: "plugin.cron" }).use(heartbeatJob())
}
