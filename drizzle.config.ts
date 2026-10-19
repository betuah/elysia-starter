import { defineConfig } from "drizzle-kit"

export default defineConfig({
	schema: "./src/db/schema/index.ts",
	out: "./migration",
	dialect: "postgresql",
	dbCredentials: {
		url: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/app",
	},
})
