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
| `DOCS_BASIC_AUTH_USER` + `DOCS_BASIC_AUTH_PASSWORD` | Optional HTTP Basic Auth (both required if either is set). If empty, docs are public while enabled. |

Example production with protected docs:

```bash
DOCS_ENABLED=true
DOCS_BASIC_AUTH_USER=docs
DOCS_BASIC_AUTH_PASSWORD=replace-me
```

Config: `src/config/docs.ts`. Plugin: `src/plugins/openapi.ts` (no-op when docs disabled).
