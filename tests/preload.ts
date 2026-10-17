process.env.NODE_ENV = "test"
// Hermetic Postgres via PGlite — no real DATABASE_URL / server needed for bun test.
process.env.USE_PGLITE = "true"
process.env.BETTER_AUTH_SECRET = "test-secret-should-be-at-least-32-characters"
process.env.BETTER_AUTH_URL = "http://localhost:3000"
process.env.TRUSTED_ORIGINS = "http://localhost:3000"
// Rate limit stays off unless a test sets RATE_LIMIT_ENABLED=true.
process.env.RATE_LIMIT_MAX = "5"
process.env.PORT = "3000"
process.env.STORAGE_DRIVER = "local"
process.env.STORAGE_LOCAL_DIR = `${process.env.TMPDIR ?? "/tmp"}/elysia-starter-storage-test`
// Keep docs public in tests even if local `.env` sets DOCS_BASIC_AUTH_*.
delete process.env.DOCS_BASIC_AUTH_USER
delete process.env.DOCS_BASIC_AUTH_PASSWORD
