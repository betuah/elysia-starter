# Elysia Starter

Starter API Bun + Elysia dengan Better Auth, ACL role, ownership (“data milik sendiri”), header keamanan, OpenAPI, i18n, dan opsi cluster/cron/Docker.

## Yang sudah tersedia

- **Auth** — email/password, forgot/reset password, email verification, Google / enterprise SSO (env-gated), admin create/ban/delete/set-role
- **ACL** — role `user` | `admin` di `src/auth/permissions.ts`
- **Ownership** — helper `assertOwnerOrPermission` agar user biasa hanya mengakses datanya sendiri
- **Security** — CORS, security headers, rate limit, Elysia `sanitize` (input), public DTO responses, cookie aman di production
- **API docs** — Scalar `/docs`, referensi auth `/api/auth/reference`
- **Database** — **Postgres only** (Drizzle + `DATABASE_URL`); tests memakai PGlite in-memory
- **Cluster** — pola resmi Elysia ([deploy.html](https://elysiajs.com/patterns/deploy.html)): primary fork → worker `import('./server')`
- **Cron** — `@elysia/cron`, aman di cluster (jalan di primary saja)
- **i18n** — locale negotiation (cookie / query / Accept-Language), catalogs `en` + `id`
- **Docker** — binary compile + distroless, compose `api` + `db`
- **File storage** — shared `getStorage()` (`local` | `s3` via Bun `S3Client` — AWS / MinIO / Wasabi / RustFS / R2); primary = server `put()`; optional S3 put/get presign; contoh avatar `POST /api/users/me/avatar`

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
| Update own profile | ✅ | `PATCH /api/users/me` (name, image URL) |
| Upload own avatar | ✅ | `POST /api/users/me/avatar` (multipart → `getStorage().put`) |
| Google sign-in | ⚙️ | `AUTH_GOOGLE_ENABLED=true` + `GOOGLE_CLIENT_*` |
| Google One Tap | ⚙️ | + `AUTH_GOOGLE_ONE_TAP_ENABLED=true` (FedCM) |
| Enterprise SSO | ⚙️ | `AUTH_SSO_ENABLED=true` + client + issuer/discovery ([Better Auth SSO plugin](https://better-auth.com/docs/plugins/sso)) |
| Provider probe | ✅ | `GET /api/auth/providers` (no secrets) + absolute Google/SSO URIs for registration |
| Email kirim nyata | ⚙️ | `RESEND_API_KEY` + `EMAIL_FROM`; tanpa itu → `console.log` mock |

### Auth providers (env toggles)

| Toggle | Juga perlu | Efek |
| --- | --- | --- |
| `AUTH_GOOGLE_ENABLED=true` | `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` | `socialProviders.google` |
| `AUTH_GOOGLE_ONE_TAP_ENABLED=true` | Google efektif | Plugin `oneTap` |
| `AUTH_SSO_ENABLED=true` | `AUTH_SSO_CLIENT_ID/SECRET` + `AUTH_SSO_ISSUER` (atau discovery) + domain | Plugin [`@better-auth/sso`](https://better-auth.com/docs/plugins/sso) `defaultSSO` |

- Prefer `AUTH_SSO_*`. Legacy `AUTH_OIDC_*` env names still work as a silent fallback if `AUTH_SSO_*` is unset.
- Discovery: set `AUTH_SSO_ISSUER` and/or `AUTH_SSO_DISCOVERY_URL` (issuer origin or full `.../.well-known/openid-configuration`).
- Schema: SSO adds table `ssoProvider`. After pull, run `bun run db:migrate` (or restart with `RUN_MIGRATIONS=true`).

### Google / SSO registration URIs

Register these with Google Cloud Console or your enterprise IdP. Docs: [Google](https://better-auth.com/docs/authentication/google), [SSO plugin](https://better-auth.com/docs/plugins/sso). `providerId` defaults to `AUTH_SSO_PROVIDER_ID` (`oidc`).

| Purpose | Path |
| --- | --- |
| Google authorized redirect | `{BETTER_AUTH_URL}/api/auth/callback/google` |
| SSO redirect/callback | `{BETTER_AUTH_URL}/api/auth/sso/callback/{providerId}` |
| SSO sign-in | `POST {BETTER_AUTH_URL}/api/auth/sign-in/sso` |
| Sign-out | `POST {BETTER_AUTH_URL}/api/auth/sign-out` |

`GET /api/auth/providers` returns the same values as absolute URIs under `google` (`enabled`, `redirectUri`, `callbackUri`, `oneTap`) and `sso` (`redirectUri`, `callbackUri`, `signInUri`, `signOutUri`) — no secrets.

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

## File storage (shared service — local | S3)

Elysia **parses** multipart (`t.File`); it does **not** ship a storage plugin. Persistence is a **shared** app service under `src/lib/storage` that any module imports. Switch drivers with `STORAGE_DRIVER` — same API.

**Two upload flows** (both supported; do not confuse them):

| Flow | When to use | Path |
| --- | --- | --- |
| **1. Server-mediated (primary)** | Always works — `local` **and** `s3` | Client multipart → your API → `getStorage().put(...)` → disk or Bun `S3Client.write` → `{ key, url }` |
| **2. Presign (optional)** | S3 only — large files / direct-to-bucket | Client asks API for put/get URL → client talks to S3; skip if `STORAGE_DRIVER=local` |

| Layer | Role |
| --- | --- |
| Any module | `import { getStorage } from "../lib/storage"` |
| `src/lib/storage` | `StorageAdapter` — `put` (primary) / `get` / `delete` / `exists` / `getPublicUrl` / optional `createPutPresignedUrl` / `createGetPresignedUrl` |
| Bun | Disk (`Bun.write`) or native [`Bun.S3Client`](https://bun.com/docs/runtime/s3) (+ optional `.presign`) |

### Flow 1 — server-mediated `put` (primary)

```ts
import { getStorage } from "../../lib/storage"

const storage = getStorage()
const { key, url, path } = await storage.put({
  body: file, // File | Blob | Uint8Array | string
  key: `notes/${userId}.txt`, // optional; else {prefix}{uuid}{ext}
  filename: file.name,
  contentType: file.type,
})
// url  — local: {STORAGE_PUBLIC_URL|APP_URL}/uploads/{key}
//       s3:    {S3_PUBLIC_URL|STORAGE_PUBLIC_URL}/{key} or Bun GET-presign if no CDN
// path — absolute filesystem path (local only)

await storage.get(key)
await storage.exists(key)
await storage.delete(key)
storage.getPublicUrl(key)
```

**Avatar example** uses this flow: `POST /api/users/me/avatar` (auth, multipart field `file`) → `getStorage().put({ key: avatars/{userId}.ext, ... })` → updates Better Auth `user.image` with the returned `url`. Works with both `STORAGE_DRIVER=local` and `s3` — no presign involved.

### Flow 2 — optional put/get presign (S3 only)

Use when the client should upload/download **directly** to/from the bucket (bypass API body size). Call from your module code — there is **no** dedicated files HTTP module. Local adapter returns `null`.

```ts
// S3 only — local returns null (use put() / GET /uploads/{key} instead)
const putUrl = await storage.createPutPresignedUrl("uploads/client.bin", {
  contentType: "application/octet-stream",
  expiresIn: 900,
})
const getUrl = await storage.createGetPresignedUrl(key, { expiresIn: 900 })
```

### Local public serving

For `STORAGE_DRIVER=local`, `plugin.storage-static` exposes **GET only**:

| Route | Auth | Notes |
| --- | --- | --- |
| `GET /uploads/{key}` | no | Serves objects for local `getPublicUrl` (matches default `{APP_URL}/uploads`) |

Override the base with `STORAGE_PUBLIC_URL` if you front uploads with a CDN or different path.

| Env | Notes |
| --- | --- |
| `STORAGE_DRIVER` | `local` (default) or `s3` |
| `STORAGE_LOCAL_DIR` | Disk root (default `storage/`) |
| `STORAGE_PREFIX` | Optional key prefix (`uploads`) |
| `STORAGE_PUBLIC_URL` | Override URL base for `getPublicUrl` |
| `S3_ENDPOINT` | S3-compatible API base. **Required** for MinIO / Wasabi / RustFS / R2 / Spaces; **omit** for AWS default |
| `S3_REGION` | Signing region (default `auto`). Use a real region for AWS / Wasabi (e.g. `us-east-1`) |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` / `S3_BUCKET` | Required when `STORAGE_DRIVER=s3` |
| `S3_PUBLIC_URL` | CDN/public base; else Bun **presigned** URL |
| `S3_FORCE_PATH_STYLE` | Path-style URLs (`endpoint/bucket/key`). Maps to Bun `virtualHostedStyle: !value` (Bun has no `forcePathStyle`). Prefer `true` for MinIO / RustFS. Unset = Bun default (path-style) |
| `S3_PRESIGN_EXPIRES` | Default expiry seconds for put/get presign (default `3600`) |

Server-side `put()` and Bun `presign()` both use the same `S3Client` options, so they work against any compatible endpoint Bun supports.

### S3 provider examples

```bash
# AWS S3 — no custom endpoint
STORAGE_DRIVER=s3
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=AKIA...
S3_SECRET_ACCESS_KEY=...
S3_BUCKET=my-bucket
# S3_PUBLIC_URL=https://cdn.example.com

# MinIO
STORAGE_DRIVER=s3
S3_ENDPOINT=http://localhost:9000
S3_REGION=us-east-1
S3_FORCE_PATH_STYLE=true
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadmin
S3_BUCKET=my-bucket

# Wasabi
STORAGE_DRIVER=s3
S3_ENDPOINT=https://s3.wasabisys.com
S3_REGION=us-east-1
S3_FORCE_PATH_STYLE=true
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_BUCKET=my-bucket

# RustFS (S3-compatible self-hosted)
STORAGE_DRIVER=s3
S3_ENDPOINT=http://localhost:9000
S3_REGION=us-east-1
S3_FORCE_PATH_STYLE=true
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_BUCKET=my-bucket
```

Raise `MAX_BODY_SIZE` for large server-side uploads (avatar allows 2 MiB).
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
├── lib/                     # actor, error, email, ownership, sanitize, response, storage/
│   └── storage/             # StorageAdapter + local / Bun S3 drivers
├── i18n/                    # catalogs + t() + negotiateLocale
├── models/                  # common.Error, pagination schemas
├── modules/
│   ├── user/
│   │   ├── repository.ts    # data access (per module)
│   │   ├── service.ts
│   │   ├── model.ts
│   │   └── index.ts
│   ├── health/, auth-providers/, i18n/
├── plugins/                 # auth, error, i18n, openapi, security, storage-static
└── scripts/seed.ts
drizzle/                     # Postgres migrations
tests/modules/<feature>/
```

## Configuration (ringkas)

Lihat `.env.example`. Penting: `BETTER_AUTH_*`, `TRUSTED_ORIGINS`, `DATABASE_URL` (Postgres), `ADMIN_*` / `USER_*`, `AUTH_GOOGLE_*` / `GOOGLE_*`, `AUTH_SSO_*`, `DEFAULT_LOCALE` / `SUPPORTED_LOCALES`, `RESEND_API_KEY`, `CRON_ENABLED`, `CLUSTER_WORKERS`, `APP_URL`, `STORAGE_DRIVER` / `S3_*`.

## Menambah modul

Buat `src/modules/<fitur>/{index,service,model,repository}.ts` (repository opsional untuk data access), daftarkan di `app.ts`, tambah permission bila perlu, dan **tambah tes di `tests/modules/<fitur>/`**. Jangan taruh domain repository di `src/db/`.
