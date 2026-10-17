/**
 * Primary-only cron bootstrap (no HTTP listen).
 * Used when cluster is on and CRON_ENABLED=true — keeps jobs off every worker.
 * Jobs live in `src/cron/` — this file only starts the scheduler.
 */
import { Elysia } from "elysia"

import { createCronPlugin } from "./cron"

new Elysia({ name: "cron-runner" }).use(createCronPlugin())

console.log(`[cron] scheduler started on primary pid=${process.pid} (no HTTP listen)`)
