# Elysia Starter

Starter API Bun + Elysia with Better Auth, role ACL, ownership (“own data only”), security headers, OpenAPI, i18n, and optional cluster/cron/Docker.

## Features ready

Capabilities already in this starter (details in linked docs):

- **Auth** — local email/password, email verification, forgot/reset, Google sign-in (+ One Tap), SSO (OIDC-compatible, env-gated via `AUTH_SSO_*`), session cookie + bearer, admin create/ban/delete/set-role; `GET /api/auth/providers` — [docs/auth.md](docs/auth.md)
- **Permission-based & role-based ACL** — roles `user` \| `admin` in `src/auth/permissions.ts`; route macros `auth` / `permission`; ownership via `assertOwnerOrPermission` — [docs/auth.md](docs/auth.md)
- **File upload** — shared `getStorage()`: `local` or S3-compatible (MinIO / Wasabi / RustFS / AWS); server-mediated `put()`; optional S3 put/get presign; avatar example `POST /api/users/me/avatar` — [docs/storage.md](docs/storage.md)
- **Database & migrations** — Postgres only (Drizzle); schema by domain under `src/db/schema/`; `bun run db:migrate` (or boot with `RUN_MIGRATIONS=true`) — [docs/database.md](docs/database.md)
- **Module-based** — feature folders with layered `index` / `model` / `service` / `repository` — [docs/modules.md](docs/modules.md)
- **API envelope** — uniform `{ code, message, data }`; lists with `meta`; validation `errors[]` via `ok` / `okList` / `failT` — [docs/api-response.md](docs/api-response.md)
- **Security** — CORS, security headers, rate limit, Elysia input `sanitize`, public DTOs — [docs/security.md](docs/security.md)
- **Email templating** — React Email (`bun run email`) + SMTP / console mock — [docs/email.md](docs/email.md)
- **i18n** — `en` + `id`; cookie / query / `Accept-Language` — [docs/i18n.md](docs/i18n.md)
- **Docs gating** — Scalar `/docs`, auth reference `/api/auth/reference`; `DOCS_ENABLED` + optional Basic Auth — [docs/openapi-docs.md](docs/openapi-docs.md)
- **Cluster / cron** — primary forks workers; cron primary-only when clustered — [docs/cluster.md](docs/cluster.md)
- **Docker** — compiled binary + distroless; compose `api` + `db` — [docs/docker.md](docs/docker.md)
- **Testing** — per-feature tests; PGlite in-memory (no Postgres server in CI) — [docs/testing.md](docs/testing.md)

## Table of contents

| Doc | Topic |
| --- | --- |
| [docs/README.md](docs/README.md) | Docs index |
| [docs/auth.md](docs/auth.md) | Auth, ACL, ownership, Google / SSO |
| [docs/security.md](docs/security.md) | Input sanitize vs response DTOs |
| [docs/api-response.md](docs/api-response.md) | Success / list / error envelopes |
| [docs/modules.md](docs/modules.md) | Feature module layout & helpers |
| [docs/database.md](docs/database.md) | Postgres, Drizzle schema, repositories |
| [docs/storage.md](docs/storage.md) | `getStorage()`, local & S3, avatar |
| [docs/i18n.md](docs/i18n.md) | Locales and catalogs |
| [docs/email.md](docs/email.md) | React Email + SMTP |
| [docs/cluster.md](docs/cluster.md) | Cluster mode & cron |
| [docs/openapi-docs.md](docs/openapi-docs.md) | OpenAPI / docs gating |
| [docs/docker.md](docs/docker.md) | Docker & compose |
| [docs/testing.md](docs/testing.md) | Test layout & PGlite |

## Quick start

Needs [Bun](https://bun.sh).

```bash
cp .env.example .env
# Set BETTER_AUTH_SECRET (openssl rand -base64 32) and DATABASE_URL
# Local Postgres: docker compose up db -d

bun install
bun run db:migrate   # or let migrations run on boot
bun run seed
bun run dev          # API http://localhost:3000
```

- API docs: http://localhost:3000/docs
- Auth reference: http://localhost:3000/api/auth/reference
- Auth providers: http://localhost:3000/api/auth/providers

Docs enable/protect: [docs/openapi-docs.md](docs/openapi-docs.md).

### Seed accounts

| Role | Email | Password |
| --- | --- | --- |
| admin | `admin@example.com` | `ChangeMe123!` |
| user | `user@example.com` | `ChangeMe123!` |

Override via `ADMIN_*` / `USER_*` in `.env`. Change passwords before exposing the app.

### Root scripts

```bash
bun run dev          # API watch
bun run start        # production process
bun test             # per-module tests
bun run typecheck
bun run seed
bun run email        # React Email preview (src/emails/) — SMTP still used to send
bun run db:generate / db:migrate / db:push / db:studio
```

### Configuration

See `.env.example`. Important: `BETTER_AUTH_*`, `TRUSTED_ORIGINS`, `DATABASE_URL` (Postgres), `ADMIN_*` / `USER_*`, `AUTH_GOOGLE_*` / `GOOGLE_*`, `AUTH_SSO_*`, `DEFAULT_LOCALE` / `SUPPORTED_LOCALES`, `SMTP_*` / `EMAIL_FROM`, `CRON_ENABLED`, `CLUSTER_WORKERS`, `APP_URL`, `STORAGE_DRIVER` / `S3_*`, `DOCS_ENABLED` / `DOCS_BASIC_AUTH_*`.

**Do not commit secrets** — copy from `.env.example` only.

## Folder structure

```text
src/
├── index.ts                 # cluster primary / single → server or cron
├── server.ts                # listen HTTP
├── cron-runner.ts           # primary-only scheduler bootstrap (no listen)
├── cron/                    # scheduled jobs (+ createCronPlugin)
├── app.ts                   # compose plugins + modules
├── auth/                    # Better Auth + permissions
├── config/                  # server, cluster, cron, docs gates
├── db/                      # infrastructure only: client, schema, migrate
│   ├── schema/              # Drizzle tables by domain + relations + columns
│   ├── providers/           # postgres.js + pglite (tests)
│   └── migrate.ts
├── emails/                  # React Email templates (bun email preview)
├── lib/                     # shared: actor, error, email, ownership, sanitize, response, storage/
├── i18n/                    # catalogs + t() + negotiateLocale
├── models/                  # common.Error, pagination / success schemas
├── modules/
│   ├── user/                # index, model, service, repository
│   ├── health/, auth-providers/, i18n/
├── plugins/                 # auth, error, i18n, openapi, security, storage-static
└── scripts/seed.ts
drizzle/                     # Postgres migrations
tests/modules/<feature>/
docs/                        # detailed guides (see TOC above)
.cursor/rules/               # AI agent conventions
```

**Adding a module:** create `src/modules/<feature>/{index,service,model,repository}.ts` (repository optional), register in `app.ts`, add permissions if needed, and add tests under `tests/modules/<feature>/`. See [docs/modules.md](docs/modules.md).
