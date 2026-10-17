# Testing

Convention: **one feature → one folder** under `tests/modules/<feature>/` (not a monolith `api.test.ts`). Shared helpers in `tests/helpers/`. Unit tests for lib/config/auth in `tests/lib`, `tests/config`, `tests/auth`.

`tests/preload.ts` sets `NODE_ENV=test` → app uses **PGlite** in-memory (same Drizzle migrations as Postgres). CI does not need a Postgres server.

```text
tests/
├── preload.ts               # USE_PGLITE / NODE_ENV=test
├── helpers/http.ts
├── auth/{permissions,providers}.test.ts
├── config/{cluster,cron,server}-config.test.ts
├── db/config.test.ts
├── i18n/i18n.test.ts
├── lib/{sanitize,response,storage}.test.ts
├── plugins/storage-static.test.ts
└── modules/
    ├── health/health.test.ts
    ├── i18n/locales.test.ts
    └── user/{http,ownership}.test.ts
```

```bash
bun test
bun run typecheck
```

When adding a module, add tests under `tests/modules/<feature>/`. See [modules.md](./modules.md), [database.md](./database.md).
