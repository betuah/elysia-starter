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

### Rate limiting + cluster

When `RATE_LIMIT_ENABLED=true`, the starter’s rate limiter (`src/plugins/rate-limit.ts`) is **in-memory and per-process**. With `CLUSTER_WORKERS > 1`, each worker has its own counters — limits are **not** shared, so the effective allowance scales roughly with worker count.

Before recommending cluster in production:

1. Keep `CLUSTER_WORKERS=0` or `1` (single process), **or**
2. Replace the in-memory map with an external store (Redis, etc.) so all workers share one budget.

On startup with multiple workers, the primary logs a warning next to the platform SO_REUSEPORT warning. See also [security.md](./security.md).

## Cron + cluster

Do not attach cron on every worker — jobs will duplicate.

| Mode | Behavior |
| --- | --- |
| `CRON_ENABLED=false` (default) | No scheduler |
| Single process + `CRON_ENABLED=true` | Cron on the HTTP app (`src/app.ts`) |
| Cluster + `CRON_ENABLED=true` | Cron on **primary only** (`src/cron-runner.ts`, no HTTP listen) |
| Escape hatch | `ENABLE_CRON=true` on **one** worker fork (`process.env`, not the shared `env` object — set via `cluster.fork({ ENABLE_CRON: "true" })`) |

Jobs live in `src/cron/` (not `src/plugins/`). Demo: heartbeat every minute (`src/cron/heartbeat.ts`, `@elysia/cron`), registered via `createCronPlugin()` in `src/cron/index.ts`. Gates: `src/config/cron.ts` → `shouldAttachCronToHttpApp()` / `shouldRunCronOnPrimary()`.
