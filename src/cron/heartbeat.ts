import { cron, Patterns } from "@elysia/cron"

/**
 * Example cron job — logs a heartbeat every minute.
 * Copy this file to add another job, then register it in `./index.ts`.
 */
export function heartbeatJob() {
	return cron({
		name: "heartbeat",
		// Every minute — quiet enough for a starter demo.
		pattern: Patterns.EVERY_MINUTE,
		run() {
			console.log(`[cron] heartbeat pid=${process.pid} at ${new Date().toISOString()}`)
		},
	})
}
