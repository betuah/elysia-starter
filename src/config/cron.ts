/**
 * Cron + cluster safety.
 *
 * Never schedule the same job on every forked worker — jobs would duplicate.
 * Official HTTP cluster pattern: https://elysiajs.com/patterns/deploy.html
 *
 * Starter approach (A + escape hatch):
 * - Cluster ON: run cron on the **primary** only (primary does not listen HTTP).
 * - Cluster OFF (dev default): attach cron to the HTTP app when CRON_ENABLED.
 * - Escape hatch: set ENABLE_CRON=true on a single worker fork if you prefer
 *   cron next to one HTTP worker instead of on the primary.
 */
export type CronGateInput = {
	/** Master switch from CRON_ENABLED */
	cronEnabled: boolean
	/** True when CLUSTER_WORKERS > 1 and this process graph uses cluster */
	clustered: boolean
	/** node:cluster isPrimary (true in single-process too) */
	isPrimary: boolean
	/** process.env.ENABLE_CRON — only one worker should receive this */
	enableCronFlag?: string | undefined
}

/** Whether this process should start scheduled jobs. */
export function shouldRunCron(input: CronGateInput): boolean {
	if (!input.cronEnabled) return false
	if (!input.clustered) return true
	if (input.isPrimary) return true
	return input.enableCronFlag === "true"
}

/**
 * Attach `@elysia/cron` to the HTTP Elysia app only when this process both
 * serves HTTP and is designated to run cron (single-process, or ENABLE_CRON worker).
 * Primary-only cron uses `src/cron-runner.ts` instead (no listen).
 */
export function shouldAttachCronToHttpApp(input: CronGateInput): boolean {
	if (!input.cronEnabled) return false
	if (!input.clustered) return true
	// Clustered primary does not import server — do not attach here.
	if (input.isPrimary) return false
	return input.enableCronFlag === "true"
}

/** Primary process should bootstrap `src/cron-runner.ts` after forking workers. */
export function shouldRunCronOnPrimary(input: CronGateInput): boolean {
	if (!input.cronEnabled) return false
	if (!input.clustered) return false
	return input.isPrimary
}
