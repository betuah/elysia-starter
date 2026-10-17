/**
 * Better Auth captcha plugin gating — pure helpers (no Better Auth import) for unit tests.
 * @see https://better-auth.com/docs/plugins/captcha
 */

export const CAPTCHA_PROVIDER_IDS = [
	"cloudflare-turnstile",
	"google-recaptcha",
	"hcaptcha",
	"captchafox",
] as const

export type CaptchaProviderId = (typeof CAPTCHA_PROVIDER_IDS)[number]

/** Default paths protected by Better Auth captcha (relative to auth base path). */
export const CAPTCHA_DEFAULT_ENDPOINTS = [
	"/sign-up/email",
	"/sign-in/email",
	"/request-password-reset",
] as const

export type CaptchaEnv = {
	CAPTCHA_ENABLED: boolean
	CAPTCHA_PROVIDER: CaptchaProviderId | undefined
	CAPTCHA_SECRET_KEY: string | undefined
	/** Public site key for client widgets (optional for Turnstile/reCAPTCHA; recommended for hCaptcha/CaptchaFox). */
	CAPTCHA_SITE_KEY: string | undefined
	/** reCAPTCHA v3 minimum score (0–1). Default 0.5 when unset. */
	CAPTCHA_MIN_SCORE: number | undefined
}

export type CaptchaPublic = {
	enabled: boolean
	provider: CaptchaProviderId | null
	/** Public widget site key — never the secret. */
	siteKey: string | null
	/** Auth-relative paths that require `x-captcha-response` when enabled. */
	endpoints: string[]
}

export function isCaptchaProviderId(value: string): value is CaptchaProviderId {
	return (CAPTCHA_PROVIDER_IDS as readonly string[]).includes(value)
}

/** Effective captcha: master toggle + provider id + secret key. */
export function isCaptchaEnabled(env: CaptchaEnv): boolean {
	return (
		env.CAPTCHA_ENABLED &&
		Boolean(env.CAPTCHA_PROVIDER && env.CAPTCHA_SECRET_KEY)
	)
}

/** Public probe fields for `GET /api/auth/providers` (no secrets). */
export function getCaptchaPublic(env: CaptchaEnv): CaptchaPublic {
	const enabled = isCaptchaEnabled(env)
	return {
		enabled,
		provider: enabled && env.CAPTCHA_PROVIDER ? env.CAPTCHA_PROVIDER : null,
		siteKey: enabled && env.CAPTCHA_SITE_KEY ? env.CAPTCHA_SITE_KEY : null,
		endpoints: enabled ? [...CAPTCHA_DEFAULT_ENDPOINTS] : [],
	}
}

/**
 * Options for `captcha()` from `better-auth/plugins`.
 * Returns null when captcha is off.
 */
export function buildCaptchaPluginOptions(env: CaptchaEnv):
	| {
			provider: "cloudflare-turnstile"
			secretKey: string
	  }
	| {
			provider: "google-recaptcha"
			secretKey: string
			minScore?: number
	  }
	| {
			provider: "hcaptcha"
			secretKey: string
			siteKey?: string
	  }
	| {
			provider: "captchafox"
			secretKey: string
			siteKey?: string
	  }
	| null {
	if (!isCaptchaEnabled(env)) return null
	const provider = env.CAPTCHA_PROVIDER!
	const secretKey = env.CAPTCHA_SECRET_KEY!

	switch (provider) {
		case "cloudflare-turnstile":
			return { provider, secretKey }
		case "google-recaptcha":
			return {
				provider,
				secretKey,
				...(env.CAPTCHA_MIN_SCORE !== undefined
					? { minScore: env.CAPTCHA_MIN_SCORE }
					: {}),
			}
		case "hcaptcha":
		case "captchafox":
			return {
				provider,
				secretKey,
				...(env.CAPTCHA_SITE_KEY ? { siteKey: env.CAPTCHA_SITE_KEY } : {}),
			}
	}
}
