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
