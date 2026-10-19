# Database (Postgres only)

This starter is **Postgres only**. SQLite / MongoDB were removed.

| Item | Value |
| --- | --- |
| Required env | `DATABASE_URL` (app / seed / Docker) |
| Auth adapter | `drizzleAdapter(..., { provider: "pg" })` |
| Schema | `src/db/schema/` (domain tables) |
| Migrations | `migration/` |
| App user queries | `src/modules/user/repository.ts` → Drizzle |
| Tests | **PGlite** in-memory (`NODE_ENV=test` / `USE_PGLITE=true`) — no Postgres server |

```bash
# Local / compose service `db`
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/app

bun run db:migrate   # or RUN_MIGRATIONS=true on boot
bun run seed
```

## Schema layout

- One **domain** per file under `src/db/schema/` (e.g. `auth.ts` for Better Auth tables, `audit.ts` for activity log).
- Shared column helpers in `columns.ts` (e.g. `timestampColumn`).
- Relations in `relations.ts` (separate from table definitions).
- Re-export from `schema/index.ts`. Do **not** dump unrelated tables into one mega-schema file.

Activity events are written with `recordAudit()` (`src/lib/audit.ts`) into `audit_log`; listed via `GET /api/audit` (admin). See [auth.md — Audit vs access logging](./auth.md#audit-vs-access-logging).

## Why repository lives in the module

Previously `src/db/repository` abstracted multiple providers. After Postgres-only, that layer is unnecessary.

**Repositories live in the module** (with the service); **`src/db/` is infrastructure only** (connection, schema, migrate). Example: `UserService` imports from `./repository`, not from `src/db/repository`.

```text
src/db/                      # client, schema, migrate — not domain repos
src/modules/user/
├── repository.ts
├── service.ts
├── model.ts
└── index.ts
```

See [modules.md](./modules.md), [testing.md](./testing.md).
