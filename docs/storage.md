# File storage (shared service — local | S3)

Elysia **parses** multipart (`t.File`); it does **not** ship a storage plugin. Persistence is a **shared** app service under `src/lib/storage` that any module imports via `getStorage()`. Switch drivers with `STORAGE_DRIVER` — same API.

**Not** a `files` feature module — call storage from the module that owns the feature (e.g. user avatar).

## Two upload flows

| Flow | When to use | Path |
| --- | --- | --- |
| **1. Server-mediated (primary)** | Always works — `local` **and** `s3` | Client multipart → API → `getStorage().put(...)` → disk or Bun `S3Client.write` → `{ key, url }` |
| **2. Presign (optional)** | S3 only — large files / direct-to-bucket | Client asks API for put/get URL → client talks to S3; skip if `STORAGE_DRIVER=local` |

| Layer | Role |
| --- | --- |
| Any module | `import { getStorage } from "../lib/storage"` |
| `src/lib/storage` | `StorageAdapter` — `put` / `get` / `delete` / `exists` / `getPublicUrl` / optional `createPutPresignedUrl` / `createGetPresignedUrl` |
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
```

**Avatar example:** `POST /api/users/me/avatar` (auth, multipart field `file`) → `getStorage().put({ key: avatars/{userId}.ext, ... })` → updates Better Auth `user.image` with the returned `url`. Works with both `STORAGE_DRIVER=local` and `s3` — no presign.

### Flow 2 — optional put/get presign (S3 only)

Presign helpers take a **storage key** (same key space as `put` / `get`). `STORAGE_PREFIX` is applied by the adapter when resolving the object path — you do **not** need a different URL prefix for put vs get.

| Helper | Method | Typical use |
| --- | --- | --- |
| `createPutPresignedUrl(key)` | HTTP PUT to the bucket | Client uploads directly; skip server `put()` body |
| `createGetPresignedUrl(key)` | HTTP GET from the bucket | Temporary download when no CDN (`S3_PUBLIC_URL`) |

```ts
const putUrl = await storage.createPutPresignedUrl("uploads/client.bin", {
  contentType: "application/octet-stream",
  expiresIn: 900,
})
const getUrl = await storage.createGetPresignedUrl(key, { expiresIn: 900 })
```

Local adapter returns `null` — use `put()` / `GET /uploads/{key}` instead. There is **no** dedicated files HTTP module.

## Local public serving

For `STORAGE_DRIVER=local`, `plugin.storage-static` exposes **GET only**:

| Route | Auth | Notes |
| --- | --- | --- |
| `GET /uploads/{key}` | no | Serves objects for local `getPublicUrl` (default `{APP_URL}/uploads`) |

Override the base with `STORAGE_PUBLIC_URL` if you front uploads with a CDN.

## Env

| Env | Notes |
| --- | --- |
| `STORAGE_DRIVER` | `local` (default) or `s3` |
| `STORAGE_LOCAL_DIR` | Disk root (default `storage/`) |
| `STORAGE_PREFIX` | Optional key prefix (`uploads`) |
| `STORAGE_PUBLIC_URL` | Override URL base for `getPublicUrl` |
| `S3_ENDPOINT` | Required for MinIO / Wasabi / RustFS / R2 / Spaces; **omit** for AWS default |
| `S3_REGION` | Signing region (default `auto`) |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` / `S3_BUCKET` | Required when `STORAGE_DRIVER=s3` |
| `S3_PUBLIC_URL` | CDN/public base; else Bun **presigned** URL |
| `S3_FORCE_PATH_STYLE` | Path-style URLs. Prefer `true` for MinIO / RustFS |
| `S3_PRESIGN_EXPIRES` | Default expiry seconds (default `3600`) |

### S3 provider examples

```bash
# AWS S3 — no custom endpoint
STORAGE_DRIVER=s3
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=AKIA...
S3_SECRET_ACCESS_KEY=...
S3_BUCKET=my-bucket

# MinIO
STORAGE_DRIVER=s3
S3_ENDPOINT=http://localhost:9000
S3_REGION=us-east-1
S3_FORCE_PATH_STYLE=true
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadmin
S3_BUCKET=my-bucket
```

Wasabi / RustFS follow the same pattern as MinIO (custom `S3_ENDPOINT` + path style). Raise `MAX_BODY_SIZE` for large server-side uploads (avatar allows 2 MiB).
