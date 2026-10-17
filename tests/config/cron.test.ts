import { describe, expect, it } from "bun:test"

import {
	shouldAttachCronToHttpApp,
	shouldRunCron,
	shouldRunCronOnPrimary,
} from "../../src/config/cron"
import { createCronPlugin } from "../../src/cron"

describe("config.cron cluster safety", () => {
	it("exports a cron plugin factory", () => {
		expect(typeof createCronPlugin).toBe("function")
		const plugin = createCronPlugin()
		expect(plugin.config.name).toBe("plugin.cron")
	})

	it("is off when CRON_ENABLED is false", () => {
		expect(
			shouldRunCron({ cronEnabled: false, clustered: false, isPrimary: true }),
		).toBe(false)
		expect(
			shouldRunCron({ cronEnabled: false, clustered: true, isPrimary: true }),
		).toBe(false)
	})

	it("runs on single-process when enabled", () => {
		expect(
			shouldRunCron({ cronEnabled: true, clustered: false, isPrimary: true }),
		).toBe(true)
		expect(
			shouldAttachCronToHttpApp({ cronEnabled: true, clustered: false, isPrimary: true }),
		).toBe(true)
	})

	it("runs on primary only under cluster (not plain workers)", () => {
		expect(
			shouldRunCronOnPrimary({ cronEnabled: true, clustered: true, isPrimary: true }),
		).toBe(true)
		expect(
			shouldRunCron({ cronEnabled: true, clustered: true, isPrimary: false }),
		).toBe(false)
		expect(
			shouldAttachCronToHttpApp({ cronEnabled: true, clustered: true, isPrimary: true }),
		).toBe(false)
		expect(
			shouldAttachCronToHttpApp({ cronEnabled: true, clustered: true, isPrimary: false }),
		).toBe(false)
	})

	it("allows ENABLE_CRON escape hatch on one worker", () => {
		expect(
			shouldRunCron({
				cronEnabled: true,
				clustered: true,
				isPrimary: false,
				enableCronFlag: "true",
			}),
		).toBe(true)
		expect(
			shouldAttachCronToHttpApp({
				cronEnabled: true,
				clustered: true,
				isPrimary: false,
				enableCronFlag: "true",
			}),
		).toBe(true)
	})
})
