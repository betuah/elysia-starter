import { describe, expect, it } from "bun:test"

import {
	buildCaptchaPluginOptions,
	CAPTCHA_DEFAULT_ENDPOINTS,
	getCaptchaPublic,
	isCaptchaEnabled,
	isCaptchaProviderId,
	type CaptchaEnv,
} from "../../src/auth/captcha"

const base: CaptchaEnv = {
	CAPTCHA_ENABLED: false,
	CAPTCHA_PROVIDER: undefined,
	CAPTCHA_SECRET_KEY: undefined,
	CAPTCHA_SITE_KEY: undefined,
	CAPTCHA_MIN_SCORE: undefined,
}

describe("auth.captcha gating", () => {
	it("recognizes supported provider ids", () => {
		expect(isCaptchaProviderId("cloudflare-turnstile")).toBe(true)
		expect(isCaptchaProviderId("google-recaptcha")).toBe(true)
		expect(isCaptchaProviderId("hcaptcha")).toBe(true)
		expect(isCaptchaProviderId("captchafox")).toBe(true)
		expect(isCaptchaProviderId("vercel-botid")).toBe(false)
		expect(isCaptchaProviderId("unknown")).toBe(false)
	})

	it("stays off without toggle, provider, or secret", () => {
		expect(isCaptchaEnabled(base)).toBe(false)
		expect(
			isCaptchaEnabled({
				...base,
				CAPTCHA_ENABLED: true,
				CAPTCHA_PROVIDER: "cloudflare-turnstile",
			}),
		).toBe(false)
		expect(
			isCaptchaEnabled({
				...base,
				CAPTCHA_ENABLED: true,
				CAPTCHA_SECRET_KEY: "secret",
			}),
		).toBe(false)
		expect(
			isCaptchaEnabled({
				...base,
				CAPTCHA_ENABLED: true,
				CAPTCHA_PROVIDER: "cloudflare-turnstile",
				CAPTCHA_SECRET_KEY: "secret",
			}),
		).toBe(true)
	})

	it("builds plugin options per provider", () => {
		expect(buildCaptchaPluginOptions(base)).toBeNull()
		expect(
			buildCaptchaPluginOptions({
				...base,
				CAPTCHA_ENABLED: true,
				CAPTCHA_PROVIDER: "cloudflare-turnstile",
				CAPTCHA_SECRET_KEY: "ts-secret",
			}),
		).toEqual({
			provider: "cloudflare-turnstile",
			secretKey: "ts-secret",
		})
		expect(
			buildCaptchaPluginOptions({
				...base,
				CAPTCHA_ENABLED: true,
				CAPTCHA_PROVIDER: "google-recaptcha",
				CAPTCHA_SECRET_KEY: "g-secret",
				CAPTCHA_MIN_SCORE: 0.7,
			}),
		).toEqual({
			provider: "google-recaptcha",
			secretKey: "g-secret",
			minScore: 0.7,
		})
		expect(
			buildCaptchaPluginOptions({
				...base,
				CAPTCHA_ENABLED: true,
				CAPTCHA_PROVIDER: "hcaptcha",
				CAPTCHA_SECRET_KEY: "h-secret",
				CAPTCHA_SITE_KEY: "h-site",
			}),
		).toEqual({
			provider: "hcaptcha",
			secretKey: "h-secret",
			siteKey: "h-site",
		})
	})

	it("exposes public captcha flags without secrets", () => {
		expect(getCaptchaPublic(base)).toEqual({
			enabled: false,
			provider: null,
			siteKey: null,
			endpoints: [],
		})
		const publicFlags = getCaptchaPublic({
			...base,
			CAPTCHA_ENABLED: true,
			CAPTCHA_PROVIDER: "cloudflare-turnstile",
			CAPTCHA_SECRET_KEY: "must-not-leak",
			CAPTCHA_SITE_KEY: "public-site-key",
		})
		expect(publicFlags).toEqual({
			enabled: true,
			provider: "cloudflare-turnstile",
			siteKey: "public-site-key",
			endpoints: [...CAPTCHA_DEFAULT_ENDPOINTS],
		})
		expect(JSON.stringify(publicFlags)).not.toContain("must-not-leak")
	})
})
