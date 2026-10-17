# Cluster and cron

## Cluster

Follows [Elysia Deploy → Cluster mode](https://elysiajs.com/patterns/deploy.html):

- `src/index.ts` — primary forks workers; worker `await import('./server')`
- `src/server.ts` — `app.listen(...)`
- `CLUSTER_WORKERS=0|auto|N` — `auto` uses `os.availableParallelism()`
- Migrations run once on the primary before fork
- **Tip:** Bun uses SO_REUSEPORT; **reliable on Linux only**

```bash
DATABASE_URL=postgresql://...
CLUSTER_WORKERS=auto
bun run start
```

## Cron + cluster

Do not attach cron on every worker — jobs will duplicate.

| Mode | Behavior |
| --- | --- |
| `CRON_ENABLED=false` (default) | No scheduler |
| Single process + `CRON_ENABLED=true` | Cron on the HTTP app (`src/app.ts`) |
| Cluster + `CRON_ENABLED=true` | Cron on **primary only** (`src/cron-runner.ts`, no HTTP listen) |
| Escape hatch | `ENABLE_CRON=true` on **one** worker fork |

Jobs live in `src/cron/` (not `src/plugins/`). Demo: heartbeat every minute (`src/cron/heartbeat.ts`, `@elysia/cron`), registered via `createCronPlugin()` in `src/cron/index.ts`. Gates: `src/config/cron.ts` → `shouldAttachCronToHttpApp()` / `shouldRunCronOnPrimary()`.
