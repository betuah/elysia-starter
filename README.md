# Elysia Starter

Starter API Bun + Elysia dengan Better Auth, ACL role, ownership (“data milik sendiri”), header keamanan, OpenAPI, i18n, dan opsi cluster/cron/Docker.

## Yang sudah tersedia

- **Auth** — email/password, forgot/reset password, email verification, Google / OIDC SSO (env-gated), admin create/ban/delete/set-role
- **ACL** — role `user` | `admin` di `src/auth/permissions.ts`
- **Ownership** — helper `assertOwnerOrPermission` agar user biasa hanya mengakses datanya sendiri
- **Security** — CORS, security headers, rate limit, Elysia `sanitize` (input), public DTO responses, cookie aman di production
- **API docs** — Scalar `/docs`, referensi auth `/api/auth/reference`
- **Database** — **Postgres only** (Drizzle + `DATABASE_URL`); tests memakai PGlite in-memory
- **Cluster** — pola resmi Elysia ([deploy.html](https://elysiajs.com/patterns/deploy.html)): primary fork → worker `import('./server')`
- **Cron** — `@elysia/cron`, aman di cluster (jalan di primary saja)
- **i18n** — locale negotiation (cookie / query / Accept-Language), catalogs `en` + `id`
- **Docker** — binary compile + distroless, compose `api` + `db`

## Menjalankan (local)

Butuh [Bun](https://bun.sh).

```bash
cp .env.example .env
# Isi BETTER_AUTH_SECRET (openssl rand -base64 32) dan DATABASE_URL
# Postgres lokal: docker compose up db -d

bun install
bun run db:migrate   # atau biarkan migrasi otomatis saat boot
bun run seed
bun run dev          # API http://localhost:3000
```

- API docs: http://localhost:3000/docs
- Auth reference: http://localhost:3000/api/auth/reference
- Auth providers: http://localhost:3000/api/auth/providers

### Akun seed

| Role | Email | Password |
| --- | --- | --- |
| admin | `admin@example.com` | `ChangeMe123!` |
| user | `user@example.com` | `ChangeMe123!` |

Override lewat `ADMIN_*` / `USER_*` di `.env`. Ganti password sebelum expose.

### Scripts root

```bash
bun run dev          # API watch
bun run start        # production process
bun test             # tests per modul
bun run typecheck
bun run seed
bun run db:generate / db:migrate / db:push / db:studio
```

---

## Roles, permissions, dan ownership

### 1. Cara menambah role / permission

Edit `src/auth/permissions.ts`:

1. Perluas `statement` (atau pakai `defaultStatements` dari admin plugin).
2. Beri action ke role lewat `ac.newRole({ ... })`.
3. Export di `roleDefinitions` (`user`, `admin`, …).
4. Admin plugin di `src/auth/index.ts` sudah memakai `ac` + `roleDefinitions`.
5. Restart API. User existing tetap punya kolom `role` sampai dipromote.

Contoh menambah resource `note`:

```ts
const statement = {
  ...defaultStatements,
  note: ["create", "read", "update", "delete", "moderate"],
} as const

const userRole = ac.newRole({ note: ["create", "read", "update", "delete"] })
const adminRole = ac.newRole({
  note: ["create", "read", "update", "delete", "moderate"],
  user: [...adminAc.statements.user],
  session: [...adminAc.statements.session],
})
```

Macro route: `permission: { note: ["create"] }`.

### 2. Ownership (“data milik sendiri”) vs role ACL

| Konsep | Pertanyaan | Tempat |
| --- | --- | --- |
| **Role ACL** | Bisakah role ini melakukan aksi admin/resource? | `hasPermission` / macro `permission` |
| **Ownership** | Apakah baris ini milik actor? | `assertOwnerOrPermission` di service |

- User biasa: `GET/PATCH /api/users/me` (profil sendiri). Tidak bisa list/ban/delete/set-role.
- Admin: list, create/invite, set-role, ban/unban, delete.

Helper: `src/lib/ownership.ts`.

### Security: sanitize (input vs response)

| Layer | Apa | Bukan |
| --- | --- | --- |
| **Elysia `sanitize`** (`src/config/server.ts`) | `stripNullBytes` + `Bun.escapeHTML` pada setiap `t.String` non-`trusted` saat validasi (utama: **input** body/query/params) | Bukan “bersihkan password yang bocor” |
| **`lib/sanitize`** | Trim / collapse whitespace / optional strip tags di service | Jangan double-`escapeHTML` di write path yang sudah lewat Elysia |
| **Response “sanitize”** | DTO publik (`toPublicUser`) + omit secret; list via `paginated()` | Bukan HTML-escape seluruh JSON response |

- Password Better Auth (`/api/auth/*` via `auth.handler`) **tidak** lewat Elysia `t.String` sanitize. Field password di route Elysia (mis. admin create user) memakai `trusted: true` agar `&` tidak jadi `&amp;`.
- Response model string memakai `trusted: true` supaya client mendapat teks mentah; escape HTML di sisi render, bukan double-encode di API.
- Jika password muncul di JSON response, itu bug data-exposure — escaping **tidak** membuat secret aman. Jangan masukkan password ke response model.

### Response shape & pagination

Tidak ada satu tipe `Success` untuk semua route — sengaja: body sukses **resource-specific** (`user.Profile`, …). Yang dishare:

- `common.Error` — `{ code, message }`
- `common.PageQuery` / `paginated()` / `paginatedSchema(item)` — `{ items, total, limit, offset }`

Lihat `src/models/`, `src/lib/response.ts`.

Pola untuk modul resource baru:

```ts
// Filter query: hanya milik sendiri, kecuali punya moderate/list-all
if (!hasPermission(actor.role, { note: ["moderate"] })) {
  // where authorId = actor.id
}
assertOwnerOrPermission(actor, row.authorId, { note: ["moderate"] })
```

### 3. Matriks fitur auth

| Fitur | Status | Env / catatan |
| --- | --- | --- |
| Login / signup email+password | ✅ | — |
| Session cookie + bearer (`set-auth-token`) | ✅ | `TRUSTED_ORIGINS` harus include origin client |
| Forgot / reset password | ✅ | Email via Resend atau console mock |
| Email verification | ✅ | `sendOnSignUp`; `REQUIRE_EMAIL_VERIFICATION=true` opsional |
| Invite / create user | ✅ | `POST /api/users` (admin) → Better Auth `createUser` |
| Promote / demote admin | ✅ | `PATCH /api/users/:id/role` |
| Ban / unban | ✅ | `POST /api/users/:id/ban|unban` (+ `/api/auth/admin/*`) |
| Delete user | ✅ | `DELETE /api/users/:id` |
| Update own profile | ✅ | `PATCH /api/users/me` (name, image) |
| Google sign-in | ⚙️ | `AUTH_GOOGLE_ENABLED=true` + `GOOGLE_CLIENT_*` |
| Google One Tap | ⚙️ | + `AUTH_GOOGLE_ONE_TAP_ENABLED=true` (FedCM) |
| Enterprise SSO (OIDC) | ⚙️ | `AUTH_SSO_ENABLED=true` + client + issuer/discovery ([Better Auth SSO plugin](https://better-auth.com/docs/plugins/sso)) |
| Provider probe | ✅ | `GET /api/auth/providers` (no secrets) + absolute SSO URIs for IdP registration |
| Email kirim nyata | ⚙️ | `RESEND_API_KEY` + `EMAIL_FROM`; tanpa itu → `console.log` mock |

### Auth providers (env toggles)

| Toggle | Juga perlu | Efek |
| --- | --- | --- |
| `AUTH_GOOGLE_ENABLED=true` | `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` | `socialProviders.google` |
| `AUTH_GOOGLE_ONE_TAP_ENABLED=true` | Google efektif | Plugin `oneTap` |
| `AUTH_SSO_ENABLED=true` | `AUTH_SSO_CLIENT_ID/SECRET` + `AUTH_SSO_ISSUER` (atau discovery) + domain | Plugin [`@better-auth/sso`](https://better-auth.com/docs/plugins/sso) `defaultSSO` |

- Prefer `AUTH_SSO_*`. Legacy `AUTH_OIDC_*` names are aliases for the same settings.
- Discovery: set `AUTH_SSO_ISSUER` and/or `AUTH_SSO_DISCOVERY_URL` (issuer origin or full `.../.well-known/openid-configuration`).
- Callbacks: Google → `{BETTER_AUTH_URL}/api/auth/callback/google`; SSO OIDC → `{BETTER_AUTH_URL}/api/auth/sso/callback/{AUTH_SSO_PROVIDER_ID}` (default provider id `oidc`).
- Schema: SSO adds table `ssoProvider`. After pull, run `bun run db:migrate` (or restart with `RUN_MIGRATIONS=true`).

### SSO / IdP registration

Register these URIs with your identity provider. `providerId` defaults to `AUTH_SSO_PROVIDER_ID` (`oidc`). Docs: [Better Auth SSO plugin](https://better-auth.com/docs/plugins/sso).

| Purpose | Path |
| --- | --- |
| OIDC redirect/callback | `{BETTER_AUTH_URL}/api/auth/sso/callback/{providerId}` |
| Sign-in | `POST {BETTER_AUTH_URL}/api/auth/sign-in/sso` |
| Sign-out | `POST {BETTER_AUTH_URL}/api/auth/sign-out` |

`GET /api/auth/providers` returns the same values as absolute URIs under `sso` (and deprecated alias `oidc`): `redirectUri`, `callbackUri`, `signInUri`, `signOutUri` — no secrets.

---

## Cluster

Pola mengikuti [Elysia Deploy → Cluster mode](https://elysiajs.com/patterns/deploy.html):

- `src/index.ts` — primary fork worker; worker `await import('./server')`
- `src/server.ts` — `app.listen(...)`
- `CLUSTER_WORKERS=0|auto|N` — `auto` memakai `os.availableParallelism()`
- Migrasi sekali di primary sebelum fork
- **Tip docs:** Bun memakai SO_REUSEPORT; **hanya andal di Linux**

```bash
DATABASE_URL=postgresql://...
CLUSTER_WORKERS=auto
bun run start
```

## Database (Postgres only)

Starter ini **hanya Postgres**. SQLite / MongoDB sudah dihapus.

| Item | Nilai |
| --- | --- |
| Env wajib | `DATABASE_URL` (app / seed / Docker) |
| Auth adapter | `drizzleAdapter(..., { provider: "pg" })` |
| Schema | `src/db/schema/` (domain tables) |
| Migrasi | `drizzle/` |
| App user queries | `src/modules/user/repository.ts` → Drizzle |
| Tests | **PGlite** in-memory (`NODE_ENV=test` / `USE_PGLITE=true`) — tanpa server Postgres |

```bash
# Local / compose service `db`
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/app

bun run db:migrate   # atau biarkan RUN_MIGRATIONS=true saat boot
bun run seed
```

### Kenapa repository di module, bukan `db/repository`?

Dulu `src/db/repository` adalah abstraksi lintas provider (SQL vs Mongo) yang berbagi satu port. Setelah Postgres-only, layer itu tidak perlu.

**Repository hidup di module** (bersama service); **`src/db/` hanya infrastruktur** (client connection, schema, migrate). Contoh: `UserService` mengimpor dari `./repository`, bukan dari `src/db/repository`.

```text
src/db/                      # client, schema, migrate — bukan domain repos
src/modules/user/
├── repository.ts            # user data access
├── service.ts               # business logic → ./repository
├── model.ts
└── index.ts                 # routes
```

## Cron + Cluster

Jangan pasang cron di setiap worker — job akan dobel.

| Mode | Perilaku |
| --- | --- |
| `CRON_ENABLED=false` (default) | Tidak ada scheduler |
| Single process + `CRON_ENABLED=true` | Cron menempel di HTTP app (`src/app.ts`) |
| Cluster + `CRON_ENABLED=true` | Cron di **primary saja** (`src/cron-runner.ts`, tanpa listen HTTP) |
| Escape hatch | `ENABLE_CRON=true` pada **satu** worker fork |

Jobs hidup di `src/cron/` (bukan `src/plugins/`). Demo: heartbeat tiap menit (`src/cron/heartbeat.ts`, `@elysia/cron`), di-register lewat `createCronPlugin()` di `src/cron/index.ts`. App mengimpor `from "./cron"` → folder itu. Gate: `src/config/cron.ts` → `shouldAttachCronToHttpApp()` / `shouldRunCronOnPrimary()`.

## Docker

Pendekatan: **multi-stage compile binary** (docs) → `gcr.io/distroless/base-debian12`. Driver `postgres` di-`--external` dan `node_modules` production ikut di-copy (bundling penuh sering merusak driver DB). Folder `drizzle/` ikut agar migrasi boot jalan.

```bash
docker build -t elysia-starter .
docker run --env-file .env -p 3000:3000 elysia-starter

# Stack: api + postgres
docker compose up --build
```

- Compose services: `db` (Postgres 16), `api` (binary)
- API membutuhkan `DATABASE_URL` mengarah ke service `db`
- OpenTelemetry / driver lain yang bermasalah saat compile: tambah `--external <pkg>` dan pastikan ada di production `node_modules` (lihat [deploy docs](https://elysiajs.com/patterns/deploy.html))

Jika binary + distroless gagal di environment Anda, alternatif: runtime `oven/bun` + `bun install --production` + `bun run src/index.ts` (dokumentasikan di override Dockerfile sendiri).

## Locale / i18n

API supports `en` + `id`.

**API negotiation** (highest wins):

1. Query `?lang=` or `?locale=`
2. Cookie `locale`
3. `Accept-Language` header
4. `DEFAULT_LOCALE` (default `en`)

- Catalogs: `src/i18n/locales/{en,id}.ts`
- Helper: `t(locale, key, params?)` in `src/i18n/`
- Context: `locale` via `i18nPlugin` (`Content-Language` response header)
- Probe: `GET /api/i18n/locales` (also linked from `/`)

**Add a string (API):**

1. Add the key to `src/i18n/locales/en.ts` and the Indonesian string in `id.ts`
2. Use `t(locale, "your.key")` or `failT(locale, status, code, "your.key")` in handlers/services

Env: `DEFAULT_LOCALE=en`, `SUPPORTED_LOCALES=en,id`.

## Testing

Convention: **satu fitur → satu folder** di bawah `tests/modules/<feature>/` (bukan monolit `api.test.ts`). Helper bersama di `tests/helpers/`. Unit lib/config/auth di `tests/lib`, `tests/config`, `tests/auth`.

`tests/preload.ts` set `NODE_ENV=test` → app memakai **PGlite** in-memory (Drizzle migrasi yang sama dengan Postgres). CI tidak butuh Postgres server.

```text
tests/
├── preload.ts               # USE_PGLITE / NODE_ENV=test
├── helpers/http.ts
├── auth/{permissions,providers}.test.ts
├── config/{cluster,cron,server}-config.test.ts
├── db/config.test.ts
├── i18n/i18n.test.ts
├── lib/{sanitize,response}.test.ts
└── modules/
    ├── health/health.test.ts
    ├── i18n/locales.test.ts
    └── user/{http,ownership}.test.ts
```

```bash
bun test
bun run typecheck
```

## Struktur

```text
src/
├── index.ts                 # cluster primary / single → server atau cron
├── server.ts                # listen HTTP
├── cron-runner.ts           # bootstrap scheduler primary-only (tanpa listen)
├── cron/                    # scheduled jobs (+ createCronPlugin)
│   ├── index.ts
│   └── heartbeat.ts
├── app.ts
├── auth/                    # Better Auth + permissions
├── config/                  # server, cluster, cron gates
├── db/                      # infrastruktur saja: client, schema, migrate
│   ├── schema/              # Drizzle Postgres tables (pg-core)
│   ├── providers/           # postgres.js + pglite (tests)
│   └── migrate.ts
├── lib/                     # actor, error, email, ownership, sanitize, response
├── i18n/                    # catalogs + t() + negotiateLocale
├── models/                  # common.Error, pagination schemas
├── modules/
│   ├── user/
│   │   ├── repository.ts    # data access (per module)
│   │   ├── service.ts
│   │   ├── model.ts
│   │   └── index.ts
│   ├── health/, auth-providers/, i18n/
├── plugins/                 # auth, error, i18n, openapi, security — bukan cron
└── scripts/seed.ts
drizzle/                     # Postgres migrations
tests/modules/<feature>/
```

## Configuration (ringkas)

Lihat `.env.example`. Penting: `BETTER_AUTH_*`, `TRUSTED_ORIGINS`, `DATABASE_URL` (Postgres), `ADMIN_*` / `USER_*`, `AUTH_GOOGLE_*` / `GOOGLE_*`, `AUTH_SSO_*` (alias `AUTH_OIDC_*`), `DEFAULT_LOCALE` / `SUPPORTED_LOCALES`, `RESEND_API_KEY`, `CRON_ENABLED`, `CLUSTER_WORKERS`, `APP_URL`.

## Menambah modul

Buat `src/modules/<fitur>/{index,service,model,repository}.ts` (repository opsional untuk data access), daftarkan di `app.ts`, tambah permission bila perlu, dan **tambah tes di `tests/modules/<fitur>/`**. Jangan taruh domain repository di `src/db/`.
