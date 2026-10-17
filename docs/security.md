# Security: sanitize (input vs response)

| Layer | What | Not |
| --- | --- | --- |
| **Elysia `sanitize`** (`src/config/server.ts`) | `stripNullBytes` + `Bun.escapeHTML` on every non-`trusted` `t.String` at validation (mainly **input** body/query/params) | Not “clean a leaked password” |
| **`lib/sanitize`** | Trim / collapse whitespace / optional strip tags in services | Do not double-`escapeHTML` on a write path that already went through Elysia |
| **Response “sanitize”** | Public DTOs (`toPublicUser`) + omit secrets; lists via `paginatedPage()` / `okList()` | Not HTML-escaping the entire JSON response |

- Better Auth passwords (`/api/auth/*` via `auth.handler`) do **not** pass through Elysia `t.String` sanitize. Password fields on Elysia routes (e.g. admin create user) use `trusted: true` so `&` is not turned into `&amp;`.
- Response model strings use `trusted: true` so clients get raw text; escape HTML at render time, not double-encode in the API.
- If a password appears in a JSON response, that is a data-exposure bug — escaping does **not** make a secret safe. Do not put passwords in response models.

Also configured: CORS, security headers, rate limit, secure cookies in production. See root README Features and `.env.example` (`TRUSTED_ORIGINS`, etc.).

## CSRF (Better Auth)

Better Auth **already protects cookie-based sessions against CSRF** — no custom CSRF middleware in this starter.

| Mechanism | Behavior here |
| --- | --- |
| **`trustedOrigins`** | From `TRUSTED_ORIGINS` (+ SSO issuer origin when SSO is on) in `src/auth/index.ts`. Untrusted `Origin` / `Referer` rejected on cookie/auth flows. |
| **SameSite cookies** | Better Auth default `SameSite=Lax` on session cookies. |
| **Fetch Metadata** | Extra first-login CSRF checks on email sign-in/sign-up (form-style requests). |
| **Secure cookies** | `advanced.useSecureCookies` when `NODE_ENV=production`. |
| **CORS** | `@elysia/cors` `origin: env.TRUSTED_ORIGINS` + `credentials: true` in `src/app.ts`. |

**Bearer tokens** (`Authorization: Bearer` / `set-auth-token`) are not CSRF-vulnerable the same way: the browser does not attach them automatically to cross-site requests. CSRF risk is primarily **cookie** sessions from a browser SPA — keep the SPA origin in `TRUSTED_ORIGINS`.

Do **not** set Better Auth `disableCSRFCheck` unless you fully understand the risk. Details: [Better Auth security](https://www.better-auth.com/docs/reference/security).

## Captcha (optional)

Gate: `CAPTCHA_ENABLED=true` + `CAPTCHA_PROVIDER` + `CAPTCHA_SECRET_KEY` (default **off**). Official Better Auth `captcha` plugin; client sends `x-captcha-response`. See [auth.md](./auth.md#captcha).

## Rate limiting

- Implementation: in-memory map in `src/plugins/rate-limit.ts` (window + max from `RATE_LIMIT_*`).
- Expired keys are swept periodically so the map does not grow forever.
- **Cluster:** counters are per-process. With `CLUSTER_WORKERS > 1`, limits are not shared — use a single process or an external store before production multi-worker. Details: [cluster.md](./cluster.md).
- Client key: when `TRUST_PROXY=true`, use `X-Forwarded-For` / `X-Real-IP`. The `x-test-ip` header is honored **only** when `NODE_ENV=test` (never in development/production).
