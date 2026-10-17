import { join } from "node:path"

/** Shared Drizzle migrations directory (repo-root `drizzle/`). */
export const MIGRATIONS_FOLDER = join(import.meta.dir, "../../drizzle")
