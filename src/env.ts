import {
	isCaptchaProviderId,
	type CaptchaProviderId,
} from "./auth/captcha"
import {
	evaluateDocsBasicAuthRequirement,
	resolveDocsEnabled,
} from "./config/docs"
import { resolveDatabaseConnection } from "./db/config"

export type NodeEnv = "development" | "test" | "production"
export type LocaleCode = "en" | "id"
export type StorageDriver = "local" | "s3"
export { resolveDatabaseConnection }

export const LOCALE_CODES = ["en", "id"] as const satisfies readonly LocaleCode[]

function nodeEnv(): NodeEnv {
	const value = process.env.NODE_ENV ?? "development"
	if (value === "development" || value === "test" || value === "production") return value
	throw new Error(`NODE_ENV must be development, test, or production. Received "${value}".`)
}

function integer(name: string, fallback: number, bounds?: { min?: number; max?: number }): number {
	const raw = process.env[name]
	if (raw === undefined || raw === "") return fallback
	const value = Number(raw)
	if (!Number.isInteger(value)) throw new Error(`${name} must be an integer.`)
	if (bounds?.min !== undefined && value < bounds.min) {
		throw new Error(`${name} must be >= ${bounds.min}.`)
	}
	if (bounds?.max !== undefined && value > bounds.max) {
		throw new Error(`${name} must be <= ${bounds.max}.`)
	}
	return value
}

const MIB = 1024 * 1024

/**
 * Max request body in bytes for Bun `serve.maxRequestBodySize`.
 * Prefer `MAX_BODY_SIZE_MIB` (mebibytes). Legacy `MAX_BODY_SIZE` (bytes) still works.
 * Default: 1 MiB.
 */
export function resolveMaxBodySizeBytes(
	envVars: NodeJS.ProcessEnv = process.env,
): number {
	const mibRaw = envVars.MAX_BODY_SIZE_MIB
	if (mibRaw !== undefined && mibRaw.trim() !== "") {
		const mib = Number(mibRaw)
		if (!Number.isInteger(mib) || mib < 1) {
			throw new Error("MAX_BODY_SIZE_MIB must be an integer >= 1.")
		}
		return mib * MIB
	}
	const bytesRaw = envVars.MAX_BODY_SIZE
	if (bytesRaw !== undefined && bytesRaw.trim() !== "") {
		const value = Number(bytesRaw)
		if (!Number.isInteger(value) || value < 1) {
			throw new Error("MAX_BODY_SIZE must be an integer >= 1.")
		}
		return value
	}
	return MIB
}

function list(name: string, fallback: string[]): string[] {
	const raw = process.env[name]
	if (raw === undefined || raw.trim() === "") return fallback
	return raw
		.split(",")
		.map((item) => item.trim())
		.filter((item) => item.length > 0)
}

function secret(): string {
	const value = process.env.BETTER_AUTH_SECRET
	if (!value) {
		throw new Error(
			"BETTER_AUTH_SECRET is required. Generate one with: openssl rand -base64 32",
		)
	}
	if (value.length < 32) {
		throw new Error("BETTER_AUTH_SECRET must be at least 32 characters.")
	}
	return value
}

function optional(name: string): string | undefined {
	const value = process.env[name]
	if (value === undefined || value.trim() === "") return undefined
	return value
}

/** Explicit feature flag: only `"true"` / `"1"` enable. Default false. */
function flag(name: string): boolean {
	const raw = process.env[name]
	return raw === "true" || raw === "1"
}

/** Live read of `RATE_LIMIT_ENABLED` — tests may toggle per case. Unset / false → off. */
export function isRateLimitEnabled(): boolean {
	return flag("RATE_LIMIT_ENABLED")
}

/**
 * Optional boolean env: unset → `undefined`; `"true"`/`"1"` → true; `"false"`/`"0"` → false.
 */
function optionalBool(name: string): boolean | undefined {
	const raw = process.env[name]
	if (raw === undefined || raw.trim() === "") return undefined
	const value = raw.trim().toLowerCase()
	if (value === "true" || value === "1") return true
	if (value === "false" || value === "0") return false
	throw new Error(`${name} must be true, false, 1, or 0. Received "${raw}".`)
}

function isLocaleCode(value: string): value is LocaleCode {
	return (LOCALE_CODES as readonly string[]).includes(value)
}

function supportedLocales(): LocaleCode[] {
	const parsed = list("SUPPORTED_LOCALES", [...LOCALE_CODES])
	const locales = parsed.filter(isLocaleCode)
	if (locales.length === 0) return [...LOCALE_CODES]
	return [...new Set(locales)]
}

function defaultLocale(supported: LocaleCode[]): LocaleCode {
	const raw = process.env.DEFAULT_LOCALE?.trim().toLowerCase()
	if (raw && isLocaleCode(raw) && supported.includes(raw)) return raw
	if (supported.includes("en")) return "en"
	return supported[0]!
}

/** First defined non-empty optional among names (primary then aliases). */
function optionalAlias(...names: string[]): string | undefined {
	for (const name of names) {
		const value = optional(name)
		if (value !== undefined) return value
	}
	return undefined
}

/** True if any named flag is `"true"` / `"1"`. */
function flagAlias(...names: string[]): boolean {
	return names.some((name) => flag(name))
}

/**
 * Normalize discovery URL: issuer origin → append `/.well-known/openid-configuration`.
 */
function normalizeDiscoveryUrl(raw: string | undefined): string | undefined {
	if (!raw) return undefined
	if (raw.includes(".well-known")) return raw
	return `${raw.replace(/\/$/, "")}/.well-known/openid-configuration`
}

/**
 * Derive OIDC issuer from explicit issuer or discovery URL
 * (strip `/.well-known/openid-configuration` when present).
 */
function deriveOidcIssuer(
	issuer: string | undefined,
	discovery: string | undefined,
): string | undefined {
	if (issuer) return issuer.replace(/\/$/, "")
	if (!discovery) return undefined
	const stripped = discovery.replace(/\/\.well-known\/openid-configuration\/?$/, "")
	return stripped.replace(/\/$/, "") || undefined
}

const environment = nodeEnv()
const port = integer("PORT", 3000)
const googleClientId = optional("GOOGLE_CLIENT_ID")
const googleClientSecret = optional("GOOGLE_CLIENT_SECRET")
const authGoogleEnabled = flag("AUTH_GOOGLE_ENABLED")

/** Prefer `AUTH_SSO_*`; `AUTH_OIDC_*` kept as aliases for existing .env files. */
const authSsoEnabled = flagAlias("AUTH_SSO_ENABLED", "AUTH_OIDC_ENABLED")
const ssoClientId = optionalAlias("AUTH_SSO_CLIENT_ID", "AUTH_OIDC_CLIENT_ID")
const ssoClientSecret = optionalAlias("AUTH_SSO_CLIENT_SECRET", "AUTH_OIDC_CLIENT_SECRET")
const ssoDiscoveryRaw = optionalAlias("AUTH_SSO_DISCOVERY_URL", "AUTH_OIDC_DISCOVERY_URL")
const ssoDiscovery = normalizeDiscoveryUrl(ssoDiscoveryRaw)
const ssoIssuerExplicit = optionalAlias("AUTH_SSO_ISSUER", "AUTH_OIDC_ISSUER")
const ssoIssuer = deriveOidcIssuer(ssoIssuerExplicit, ssoDiscovery ?? ssoDiscoveryRaw)
const ssoAuthUrl = optionalAlias("AUTH_SSO_AUTHORIZATION_URL", "AUTH_OIDC_AUTHORIZATION_URL")
const ssoTokenUrl = optionalAlias("AUTH_SSO_TOKEN_URL", "AUTH_OIDC_TOKEN_URL")
const ssoUserInfoUrl = optionalAlias("AUTH_SSO_USERINFO_URL", "AUTH_OIDC_USERINFO_URL")
const ssoJwksUrl = optionalAlias("AUTH_SSO_JWKS_URL", "AUTH_OIDC_JWKS_URL")
const ssoProviderId =
	optionalAlias("AUTH_SSO_PROVIDER_ID", "AUTH_OIDC_PROVIDER_ID")?.trim() || "oidc"
const ssoName = optionalAlias("AUTH_SSO_NAME", "AUTH_OIDC_NAME")?.trim() || "SSO"
const ssoDomain =
	optionalAlias("AUTH_SSO_DOMAIN", "AUTH_OIDC_DOMAIN")?.trim() || "localhost"
const ssoScopes = (() => {
	const raw = process.env.AUTH_SSO_SCOPES ?? process.env.AUTH_OIDC_SCOPES
	if (raw === undefined || raw.trim() === "") return ["openid", "profile", "email"]
	return raw
		.split(/[\s,]+/)
		.map((item) => item.trim())
		.filter((item) => item.length > 0)
})()
const ssoEffectivelyEnabled =
	authSsoEnabled &&
	Boolean(ssoClientId && ssoClientSecret && ssoIssuer) &&
	Boolean(ssoDiscovery || (ssoAuthUrl && ssoTokenUrl))

const supportedLocaleList = supportedLocales()
const defaultLocaleValue = defaultLocale(supportedLocaleList)

function storageDriver(): StorageDriver {
	const raw = (process.env.STORAGE_DRIVER ?? "local").trim().toLowerCase()
	if (raw === "local" || raw === "s3") return raw
	throw new Error(`STORAGE_DRIVER must be local or s3. Received "${raw}".`)
}

const storageDriverValue = storageDriver()
const s3AccessKeyId = optional("S3_ACCESS_KEY_ID")
const s3SecretAccessKey = optional("S3_SECRET_ACCESS_KEY")
const s3Bucket = optional("S3_BUCKET")

if (storageDriverValue === "s3") {
	const missing = [
		!s3AccessKeyId && "S3_ACCESS_KEY_ID",
		!s3SecretAccessKey && "S3_SECRET_ACCESS_KEY",
		!s3Bucket && "S3_BUCKET",
	].filter(Boolean)
	if (missing.length > 0) {
		throw new Error(
			`STORAGE_DRIVER=s3 requires ${missing.join(", ")}. Set credentials or use STORAGE_DRIVER=local.`,
		)
	}
}

/** Captcha — Better Auth plugin; off unless CAPTCHA_ENABLED + provider + secret. */
const captchaEnabledFlag = flag("CAPTCHA_ENABLED")
const captchaProviderRaw = optional("CAPTCHA_PROVIDER")?.trim().toLowerCase()
const captchaProvider: CaptchaProviderId | undefined = (() => {
	if (!captchaProviderRaw) return undefined
	if (!isCaptchaProviderId(captchaProviderRaw)) {
		throw new Error(
			`CAPTCHA_PROVIDER must be one of: cloudflare-turnstile, google-recaptcha, hcaptcha, captchafox. Received "${captchaProviderRaw}".`,
		)
	}
	return captchaProviderRaw
})()
const captchaSecretKey = optional("CAPTCHA_SECRET_KEY")
const captchaSiteKey = optional("CAPTCHA_SITE_KEY")
const captchaMinScore = (() => {
	const raw = process.env.CAPTCHA_MIN_SCORE
	if (raw === undefined || raw.trim() === "") return undefined
	const value = Number(raw)
	if (!Number.isFinite(value) || value < 0 || value > 1) {
		throw new Error(`CAPTCHA_MIN_SCORE must be a number between 0 and 1. Received "${raw}".`)
	}
	return value
})()

if (captchaEnabledFlag) {
	const missing = [
		!captchaProvider && "CAPTCHA_PROVIDER",
		!captchaSecretKey && "CAPTCHA_SECRET_KEY",
	].filter(Boolean)
	if (missing.length > 0) {
		throw new Error(
			`CAPTCHA_ENABLED=true requires ${missing.join(" and ")}. Set credentials or set CAPTCHA_ENABLED=false.`,
		)
	}
}

/** Postgres connection — DATABASE_URL required unless USE_PGLITE / NODE_ENV=test. */
const database = resolveDatabaseConnection(process.env as {
	NODE_ENV?: string
	DATABASE_URL?: string
	USE_PGLITE?: string
})

export const env = {
	NODE_ENV: environment,
	PORT: port,
	HOST: process.env.HOST || "0.0.0.0",
	/** Postgres connection string (ignored when USE_PGLITE). */
	DATABASE_URL: database.url,
	/**
	 * In-memory PGlite instead of postgres.js.
	 * Auto-on when `NODE_ENV=test` so `bun test` needs no real server.
	 */
	USE_PGLITE: database.usePglite,
	BETTER_AUTH_SECRET: secret(),
	BETTER_AUTH_URL: process.env.BETTER_AUTH_URL || `http://localhost:${port}`,
	TRUSTED_ORIGINS: list("TRUSTED_ORIGINS", [`http://localhost:${port}`]),
	TRUST_PROXY: process.env.TRUST_PROXY === "true",
	/**
	 * App + Better Auth rate limiting. Default **off** (unset / false).
	 * Set `RATE_LIMIT_ENABLED=true` to enable. Live checks use {@link isRateLimitEnabled}.
	 */
	RATE_LIMIT_ENABLED: flag("RATE_LIMIT_ENABLED"),
	RATE_LIMIT_WINDOW_MS: integer("RATE_LIMIT_WINDOW_MS", 60_000),
	RATE_LIMIT_MAX: integer("RATE_LIMIT_MAX", 120),
	/**
	 * Max HTTP request body size in **bytes** (Bun `serve.maxRequestBodySize`).
	 * Configure via `MAX_BODY_SIZE_MIB` (preferred) or legacy `MAX_BODY_SIZE` (bytes). Default 1 MiB.
	 */
	MAX_BODY_SIZE: resolveMaxBodySizeBytes(),
	/**
	 * Idle connection timeout in seconds (Bun `serve.idleTimeout`).
	 * Bun allows 0–255; `0` disables. Default 30 (matches Elysia's Bun adapter).
	 */
	IDLE_TIMEOUT: integer("IDLE_TIMEOUT", 30, { min: 0, max: 255 }),
	/**
	 * Cluster workers: `0` (default, single process), `auto` (CPU count), or `N`.
	 * Off by default so `bun run dev` / `bun test` stay single-process.
	 */
	CLUSTER_WORKERS: process.env.CLUSTER_WORKERS ?? "0",
	/**
	 * Run Drizzle `migrate()` on DB open. Default true.
	 * Cluster primary migrates once then forks workers with `RUN_MIGRATIONS=false`.
	 * Set false when migrations run in a separate step (`bun run db:migrate`).
	 */
	RUN_MIGRATIONS: process.env.RUN_MIGRATIONS !== "false",
	ADMIN_NAME: process.env.ADMIN_NAME || "Administrator",
	ADMIN_EMAIL: process.env.ADMIN_EMAIL || "admin@example.com",
	ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || "ChangeMe123!",
	USER_NAME: process.env.USER_NAME || "Demo User",
	USER_EMAIL: process.env.USER_EMAIL || "user@example.com",
	USER_PASSWORD: process.env.USER_PASSWORD || "ChangeMe123!",
	/**
	 * SMTP — when `SMTP_HOST` is unset, emails are mocked to the console.
	 * Set `SMTP_SECURE=true` for port 465 (implicit TLS).
	 * Set `SMTP_REJECT_UNAUTHORIZED=false` to allow self-signed certs (dev only).
	 */
	SMTP_HOST: optional("SMTP_HOST"),
	SMTP_PORT: integer("SMTP_PORT", 587, { min: 1, max: 65535 }),
	SMTP_SECURE: flag("SMTP_SECURE"),
	SMTP_USER: optional("SMTP_USER"),
	SMTP_PASS: optional("SMTP_PASS"),
	/** Unset → default Node TLS verification; `false` → allow self-signed (dev). */
	SMTP_REJECT_UNAUTHORIZED: optionalBool("SMTP_REJECT_UNAUTHORIZED"),
	EMAIL_FROM: process.env.EMAIL_FROM || "Elysia Starter <noreply@localhost>",
	/** App base URL used in email links (password reset, verification). */
	APP_URL:
		process.env.APP_URL ||
		process.env.BETTER_AUTH_URL ||
		`http://localhost:${port}`,
	GOOGLE_CLIENT_ID: googleClientId,
	GOOGLE_CLIENT_SECRET: googleClientSecret,
	/** Master toggle — still requires `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`. */
	AUTH_GOOGLE_ENABLED: authGoogleEnabled,
	/** One Tap — requires Google effectively enabled. */
	AUTH_GOOGLE_ONE_TAP_ENABLED: flag("AUTH_GOOGLE_ONE_TAP_ENABLED"),
	/**
	 * Effective Google OAuth: toggle + both credentials.
	 * Prefer this over checking credentials alone.
	 */
	GOOGLE_ENABLED:
		authGoogleEnabled && Boolean(googleClientId && googleClientSecret),
	/**
	 * Enterprise SSO via `@better-auth/sso` (OIDC/SAML).
	 * Prefer `AUTH_SSO_*`. Legacy `AUTH_OIDC_*` process.env names are still read
	 * as a silent fallback when parsing (not exported on this object).
	 * @see https://better-auth.com/docs/plugins/sso
	 */
	AUTH_SSO_ENABLED: authSsoEnabled,
	AUTH_SSO_PROVIDER_ID: ssoProviderId,
	AUTH_SSO_NAME: ssoName,
	AUTH_SSO_CLIENT_ID: ssoClientId,
	AUTH_SSO_CLIENT_SECRET: ssoClientSecret,
	AUTH_SSO_ISSUER: ssoIssuer,
	AUTH_SSO_DOMAIN: ssoDomain,
	AUTH_SSO_DISCOVERY_URL: ssoDiscovery,
	AUTH_SSO_AUTHORIZATION_URL: ssoAuthUrl,
	AUTH_SSO_TOKEN_URL: ssoTokenUrl,
	AUTH_SSO_USERINFO_URL: ssoUserInfoUrl,
	AUTH_SSO_JWKS_URL: ssoJwksUrl,
	AUTH_SSO_SCOPES: ssoScopes,
	/** Effective SSO: toggle + credentials + issuer + discovery or auth/token URLs. */
	SSO_ENABLED: ssoEffectivelyEnabled,
	/**
	 * Require email verification before sign-in. Default false for local MVP;
	 * verification emails still send when handlers are configured.
	 */
	REQUIRE_EMAIL_VERIFICATION: process.env.REQUIRE_EMAIL_VERIFICATION === "true",
	/**
	 * Better Auth captcha plugin (`better-auth/plugins` `captcha`).
	 * Default off. When true, requires `CAPTCHA_PROVIDER` + `CAPTCHA_SECRET_KEY`.
	 * Client sends token in `x-captcha-response` on protected auth paths.
	 * @see https://better-auth.com/docs/plugins/captcha
	 */
	CAPTCHA_ENABLED: captchaEnabledFlag,
	CAPTCHA_PROVIDER: captchaProvider,
	CAPTCHA_SECRET_KEY: captchaSecretKey,
	/** Public site key for SPA widgets (safe to expose via `/api/auth/providers`). */
	CAPTCHA_SITE_KEY: captchaSiteKey,
	/** reCAPTCHA v3 score threshold (0–1). Unset → plugin default 0.5. */
	CAPTCHA_MIN_SCORE: captchaMinScore,
	/** Effective: toggle + provider + secret. */
	CAPTCHA_EFFECTIVE:
		captchaEnabledFlag && Boolean(captchaProvider && captchaSecretKey),
	/**
	 * Master switch for `@elysia/cron` jobs. Default false (quiet in dev/test).
	 * Under cluster, cron runs on the primary only — see `src/config/cron.ts`.
	 */
	CRON_ENABLED: process.env.CRON_ENABLED === "true",
	/** Default UI/API locale when negotiation finds nothing. */
	DEFAULT_LOCALE: defaultLocaleValue,
	/** Comma-separated supported locales (`en`, `id`). */
	SUPPORTED_LOCALES: supportedLocaleList,
	/**
	 * File storage backend: `local` (disk under STORAGE_LOCAL_DIR) or `s3`
	 * (Bun native S3Client — AWS, MinIO, Wasabi, RustFS, R2, and other S3-compatible APIs).
	 */
	STORAGE_DRIVER: storageDriverValue,
	/** Local root directory (cwd-relative or absolute). Default `storage`. */
	STORAGE_LOCAL_DIR: process.env.STORAGE_LOCAL_DIR?.trim() || "storage",
	/** Optional key prefix for both drivers (e.g. `uploads/`). */
	STORAGE_PREFIX: (() => {
		const raw = process.env.STORAGE_PREFIX?.trim() ?? ""
		return raw.replace(/^\/+|\/+$/g, "")
	})(),
	/**
	 * Override base for `getPublicUrl` (no trailing slash).
	 * Local default: `{APP_URL}/uploads`. S3: also accepts `S3_PUBLIC_URL`.
	 */
	STORAGE_PUBLIC_URL: optional("STORAGE_PUBLIC_URL"),
	/**
	 * S3-compatible API endpoint. Required for MinIO / Wasabi / RustFS / R2 / Spaces.
	 * Leave unset for AWS (Bun infers `https://s3.<region>.amazonaws.com` from region + bucket).
	 */
	S3_ENDPOINT: optional("S3_ENDPOINT"),
	/**
	 * Signing / endpoint region. AWS & Wasabi: real region (e.g. `us-east-1`).
	 * R2 often uses `auto`. Default `auto` (compatible with R2; set explicitly for AWS).
	 */
	S3_REGION: process.env.S3_REGION?.trim() || "auto",
	S3_ACCESS_KEY_ID: s3AccessKeyId,
	S3_SECRET_ACCESS_KEY: s3SecretAccessKey,
	S3_BUCKET: s3Bucket,
	/** Public CDN / bucket URL for S3 objects (preferred over presigned URLs). */
	S3_PUBLIC_URL: optional("S3_PUBLIC_URL"),
	/**
	 * Path-style requests (`endpoint/bucket/key`). Bun maps this to
	 * `virtualHostedStyle: !S3_FORCE_PATH_STYLE` (Bun has no `forcePathStyle` option).
	 * Unset → Bun default (path-style). Set `false` for virtual-hosted (`bucket.endpoint`).
	 * Prefer `true` for MinIO / RustFS and many self-hosted S3 APIs.
	 */
	S3_FORCE_PATH_STYLE: optionalBool("S3_FORCE_PATH_STYLE"),
	/**
	 * Default expiry (seconds) for Bun S3 put/get presigned URLs and for
	 * `getPublicUrl` when no CDN base is set. Default 3600 (1 hour).
	 */
	S3_PRESIGN_EXPIRES: integer("S3_PRESIGN_EXPIRES", 3600, { min: 1, max: 604_800 }),
	/**
	 * Mount Scalar `/docs` + Better Auth `/api/auth/reference`.
	 * Unset → enabled when `NODE_ENV` is not `production`; set `true`/`false` to override.
	 */
	DOCS_ENABLED: resolveDocsEnabled({
		docsEnabled: optionalBool("DOCS_ENABLED"),
		nodeEnv: environment,
	}),
	/**
	 * HTTP Basic Auth for docs surfaces (`/docs`, `/docs/json`,
	 * `/api/auth/reference`, `/api/auth/open-api/*`). Both must be set together.
	 * Required in production when `DOCS_ENABLED`; recommended in development.
	 */
	DOCS_BASIC_AUTH_USER: optional("DOCS_BASIC_AUTH_USER"),
	DOCS_BASIC_AUTH_PASSWORD: optional("DOCS_BASIC_AUTH_PASSWORD"),
} as const

const docsUser = env.DOCS_BASIC_AUTH_USER
const docsPassword = env.DOCS_BASIC_AUTH_PASSWORD
if (Boolean(docsUser) !== Boolean(docsPassword)) {
	throw new Error(
		"DOCS_BASIC_AUTH_USER and DOCS_BASIC_AUTH_PASSWORD must both be set, or both omitted.",
	)
}

const docsBasicAuthRequirement = evaluateDocsBasicAuthRequirement({
	docsEnabled: env.DOCS_ENABLED,
	user: docsUser,
	password: docsPassword,
	nodeEnv: environment,
})
if (docsBasicAuthRequirement.action === "throw") {
	throw new Error(docsBasicAuthRequirement.message)
}
if (docsBasicAuthRequirement.action === "warn") {
	console.warn(docsBasicAuthRequirement.message)
}
