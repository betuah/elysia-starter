# Feature modules

## Layout

Create `src/modules/<feature>/` with:

| File | Role |
| --- | --- |
| `index.ts` | Elysia routes (prefix, tags, `.use` plugins, wire handlers) |
| `model.ts` | Elysia `t` schemas / OpenAPI models (success envelope wrappers) |
| `service.ts` | Business logic, ACL/ownership, `ok` / `failT` |
| `repository.ts` | Optional — Drizzle data access for this domain |

Register the module in `src/app.ts`. Add permissions in `src/auth/permissions.ts` when needed. Add tests under `tests/modules/<feature>/`.

**Do not** put domain repositories under `src/db/` — that folder is infrastructure only (client, schema, migrate).

```text
src/modules/user/
├── repository.ts    # user data access
├── service.ts       # business logic → ./repository
├── model.ts
└── index.ts         # routes

src/modules/audit/   # activity log list (admin); writer is shared `src/lib/audit.ts`
```

Simpler modules (health, i18n probe, auth-providers) may only need `index.ts`.

## Helpers: shared vs local

| Kind | Location |
| --- | --- |
| Cross-cutting (response, error, ownership, sanitize, storage, email, actor, audit) | `src/lib/` |
| Domain-only helper | Next to the module (same folder or `src/modules/<feature>/…`) |

## Auth on routes

Use `authPlugin` macros (`.use(authPlugin)` on the module):

- `auth: true` — require session
- `permission: { note: ["create"] }` — require ACL

After either macro, handlers get `user` (`Actor` with `id`, …), `sessionId`, and `locale` — use `user.id`; do not parse the cookie/bearer manually. Details: [auth.md — Route macros and request context](./auth.md#route-macros-and-request-context).

See also [api-response.md](./api-response.md), [database.md](./database.md).
