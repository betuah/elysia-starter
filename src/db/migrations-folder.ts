import { join } from "node:path"

/** Shared Drizzle migrations directory (repo-root `migration/`). */
export const MIGRATIONS_FOLDER = join(import.meta.dir, "../../migration")
