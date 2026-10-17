/**
 * Auth provider gating — pure helpers (no Better Auth import) so unit tests stay light.
 * Secrets never appear in {@link AuthProvidersPublic}.
 *
 * Enterprise SSO uses `@better-auth/sso` (`defaultSSO`), not `genericOAuth`.
 * Env: prefer `AUTH_SSO_*` (`AUTH_OIDC_*` may still be read as a silent env fallback).
 */

export type AuthProviderEnv = {
	/** Public base URL for auth routes (used to build IdP registration URIs). */
	BETTER_AUTH_URL: string
	AUTH_GOOGLE_ENABLED: boolean
	AUTH_GOOGLE_ONE_TAP_ENABLED: boolean
	GOOGLE_CLIENT_ID: string | undefined
	GOOGLE_CLIENT_SECRET: string | undefined
	/** Master toggle — `AUTH_SSO_ENABLED`. */
	AUTH_SSO_ENABLED: boolean
	AUTH_SSO_PROVIDER_ID: string
	AUTH_SSO_NAME: string
	AUTH_SSO_CLIENT_ID: string | undefined
	AUTH_SSO_CLIENT_SECRET: string | undefined
	/** OIDC issuer URL (required for SSO plugin). */
	AUTH_SSO_ISSUER: string | undefined
	/** Email domain(s) for provider matching (comma-separated ok). */
	AUTH_SSO_DOMAIN: string
	AUTH_SSO_DISCOVERY_URL: string | undefined
	AUTH_SSO_AUTHORIZATION_URL: string | undefined
	AUTH_SSO_TOKEN_URL: string | undefined
	AUTH_SSO_USERINFO_URL: string | undefined
	AUTH_SSO_JWKS_URL: string | undefined
	AUTH_SSO_SCOPES: string[]
}

export type GoogleProviderPublic = {
	enabled: boolean
	/** Google Cloud Console authorized redirect URI. */
	redirectUri: string
	/** Alias of {@link GoogleProviderPublic.redirectUri}. */
	callbackUri: string
	/** Google One Tap (FedCM) when Google is effectively on. */
	oneTap: boolean
}

export type SsoProviderPublic = {
	enabled: boolean
	providerId: string
	name: string
	domain: string
	/** OIDC redirect/callback URI to register with the IdP. */
	redirectUri: string
	/** Alias of {@link SsoProviderPublic.redirectUri}. */
	callbackUri: string
	/** Absolute URI for `POST /api/auth/sign-in/sso`. */
	signInUri: string
	/** Absolute URI for `POST /api/auth/sign-out`. */
	signOutUri: string
}

export type AuthProvidersPublic = {
	emailPassword: true
	google: GoogleProviderPublic
	/** Official Better Auth SSO plugin (OIDC/SAML). */
	sso: SsoProviderPublic
}

/** Shape for `@better-auth/sso` `defaultSSO` OIDC entry. */
export type SsoDefaultOidcEntry = {
	providerId: string
	domain: string
	oidcConfig: {
		issuer: string
		clientId: string
		clientSecret: string
		discoveryEndpoint: string
		pkce: true
		scopes: string[]
		authorizationEndpoint?: string
		tokenEndpoint?: string
		userInfoEndpoint?: string
		jwksEndpoint?: string
	}
}

function hasCredentials(id?: string, secret?: string): boolean {
	return Boolean(id && secret)
}

function authBaseUrl(url: string): string {
	return url.replace(/\/$/, "")
}

/** Google social provider when toggle + both OAuth credentials are set. */
export function isGoogleEnabled(env: AuthProviderEnv): boolean {
	return env.AUTH_GOOGLE_ENABLED && hasCredentials(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET)
}

/** One Tap only when Google is effectively on and the One Tap toggle is set. */
export function isGoogleOneTapEnabled(env: AuthProviderEnv): boolean {
	return isGoogleEnabled(env) && env.AUTH_GOOGLE_ONE_TAP_ENABLED
}

/**
 * Enterprise SSO (OIDC via `@better-auth/sso`) when toggle + credentials + issuer
 * and discovery URL (or explicit authorization + token URLs) are present.
 */
export function isSsoEnabled(env: AuthProviderEnv): boolean {
	if (!env.AUTH_SSO_ENABLED) return false
	if (!hasCredentials(env.AUTH_SSO_CLIENT_ID, env.AUTH_SSO_CLIENT_SECRET)) return false
	if (!env.AUTH_SSO_ISSUER) return false
	if (env.AUTH_SSO_DISCOVERY_URL) return true
	return Boolean(env.AUTH_SSO_AUTHORIZATION_URL && env.AUTH_SSO_TOKEN_URL)
}

function googlePublic(env: AuthProviderEnv): GoogleProviderPublic {
	const base = authBaseUrl(env.BETTER_AUTH_URL)
	const redirectUri = `${base}/api/auth/callback/google`
	return {
		enabled: isGoogleEnabled(env),
		redirectUri,
		callbackUri: redirectUri,
		oneTap: isGoogleOneTapEnabled(env),
	}
}

function ssoPublic(env: AuthProviderEnv): SsoProviderPublic {
	const enabled = isSsoEnabled(env)
	const base = authBaseUrl(env.BETTER_AUTH_URL)
	const providerId = env.AUTH_SSO_PROVIDER_ID
	const redirectUri = `${base}/api/auth/sso/callback/${providerId}`
	return {
		enabled,
		providerId,
		name: env.AUTH_SSO_NAME,
		domain: env.AUTH_SSO_DOMAIN,
		redirectUri,
		callbackUri: redirectUri,
		signInUri: `${base}/api/auth/sign-in/sso`,
		signOutUri: `${base}/api/auth/sign-out`,
	}
}

/** Public flags + IdP registration URIs (no secrets). */
export function getAuthProvidersPublic(env: AuthProviderEnv): AuthProvidersPublic {
	return {
		emailPassword: true,
		google: googlePublic(env),
		sso: ssoPublic(env),
	}
}

/**
 * Build `defaultSSO` OIDC entry for the official SSO plugin.
 * Returns null when SSO is not effectively enabled.
 */
export function buildSsoDefaultConfig(env: AuthProviderEnv): SsoDefaultOidcEntry | null {
	if (!isSsoEnabled(env)) return null
	const clientId = env.AUTH_SSO_CLIENT_ID
	const clientSecret = env.AUTH_SSO_CLIENT_SECRET
	const issuer = env.AUTH_SSO_ISSUER
	if (!clientId || !clientSecret || !issuer) return null

	const discoveryEndpoint =
		env.AUTH_SSO_DISCOVERY_URL ??
		`${issuer.replace(/\/$/, "")}/.well-known/openid-configuration`

	const entry: SsoDefaultOidcEntry = {
		providerId: env.AUTH_SSO_PROVIDER_ID,
		domain: env.AUTH_SSO_DOMAIN,
		oidcConfig: {
			issuer,
			clientId,
			clientSecret,
			discoveryEndpoint,
			pkce: true,
			scopes: env.AUTH_SSO_SCOPES,
		},
	}

	if (env.AUTH_SSO_AUTHORIZATION_URL) {
		entry.oidcConfig.authorizationEndpoint = env.AUTH_SSO_AUTHORIZATION_URL
	}
	if (env.AUTH_SSO_TOKEN_URL) {
		entry.oidcConfig.tokenEndpoint = env.AUTH_SSO_TOKEN_URL
	}
	if (env.AUTH_SSO_USERINFO_URL) {
		entry.oidcConfig.userInfoEndpoint = env.AUTH_SSO_USERINFO_URL
	}
	if (env.AUTH_SSO_JWKS_URL) {
		entry.oidcConfig.jwksEndpoint = env.AUTH_SSO_JWKS_URL
	}

	return entry
}
