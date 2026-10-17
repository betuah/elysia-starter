import { timestamp } from "drizzle-orm/pg-core"

export const timestampColumn = (name: string) => timestamp(name, { mode: "date" }).defaultNow().notNull()
