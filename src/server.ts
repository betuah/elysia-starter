import { isDocsBasicAuthConfigured } from "./config/docs"
import { app } from "./app"
import { env } from "./env"

const hostname = env.HOST === "0.0.0.0" ? "localhost" : env.HOST

app.listen({ port: env.PORT, hostname: env.HOST })

const pid = process.pid
console.log(`${env.APP_NAME} is running at http://${hostname}:${env.PORT} (pid ${pid})`)
if (env.DOCS_ENABLED) {
	const authNote = isDocsBasicAuthConfigured(env.DOCS_BASIC_AUTH_USER, env.DOCS_BASIC_AUTH_PASSWORD)
		? " (Basic Auth)"
		: " (public — set DOCS_BASIC_AUTH_*)"
	console.log(`API docs: http://${hostname}:${env.PORT}/docs${authNote}`)
	console.log(`Auth reference: http://${hostname}:${env.PORT}/api/auth/reference${authNote}`)
} else {
	console.log("API docs: disabled (DOCS_ENABLED=false)")
}
