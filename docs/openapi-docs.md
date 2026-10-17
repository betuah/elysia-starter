# OpenAPI / docs gating

One flag controls **both** docs surfaces:

| URL | Source |
| --- | --- |
| `/docs`, `/docs/json` | Elysia OpenAPI / Scalar |
| `/api/auth/reference`, `/api/auth/open-api/generate-schema` | Better Auth openAPI plugin |

| Env | Behavior |
| --- | --- |
| `DOCS_ENABLED` unset | **On** if `NODE_ENV` ≠ `production`; **off** in production |
| `DOCS_ENABLED=true` / `false` | Explicit override |
| `DOCS_BASIC_AUTH_USER` + `DOCS_BASIC_AUTH_PASSWORD` | HTTP Basic Auth (both required if either is set). Protects `/docs`, `/docs/json`, `/api/auth/reference`, `/api/auth/open-api/*`. |

**When credentials are missing and docs are enabled:**

| `NODE_ENV` | Behavior |
| --- | --- |
| `production` | **Boot fails** — set both credentials, or `DOCS_ENABLED=false` |
| `development` | **Warning** at startup; docs stay public |
| `test` | Allowed (no warning) so CI stays quiet |

Example (placeholders — change in real deploys):

```bash
DOCS_ENABLED=true
DOCS_BASIC_AUTH_USER=docs
DOCS_BASIC_AUTH_PASSWORD=change-me
```

Config: `src/config/docs.ts`. Plugin: `src/plugins/openapi.ts` (no-op when docs disabled). Auth gate: `src/plugins/security.ts`.
