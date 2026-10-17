import { app } from "./app"
import { env } from "./env"

const hostname = env.HOST === "0.0.0.0" ? "localhost" : env.HOST

app.listen({ port: env.PORT, hostname: env.HOST })

const pid = process.pid
console.log(`Elysia starter is running at http://${hostname}:${env.PORT} (pid ${pid})`)
if (env.DOCS_ENABLED) {
	console.log(`API docs: http://${hostname}:${env.PORT}/docs`)
	console.log(`Auth reference: http://${hostname}:${env.PORT}/api/auth/reference`)
} else {
	console.log("API docs: disabled (DOCS_ENABLED=false)")
}
