# Docker

Approach: **multi-stage compile binary** → `gcr.io/distroless/base-debian12`. The `postgres` driver is `--external` and production `node_modules` are copied (full bundling often breaks DB drivers). Folder `migration/` is included so boot migrations work.

```bash
docker build -t elysia-starter .
docker run --env-file .env -p 3000:3000 elysia-starter

# Stack: api + postgres
docker compose up --build
```

- Compose services: `db` (Postgres 16), `api` (binary)
- API needs `DATABASE_URL` pointing at service `db`
- OpenTelemetry / other drivers that break at compile: add `--external <pkg>` and keep them in production `node_modules` (see [deploy docs](https://elysiajs.com/patterns/deploy.html))

If binary + distroless fails in your environment, alternative: runtime `oven/bun` + `bun install --production` + `bun run src/index.ts` (document in your own Dockerfile override).
