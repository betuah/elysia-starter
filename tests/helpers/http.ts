import { app } from "../../src/app"
import { env } from "../../src/env"

export const origin = env.BETTER_AUTH_URL

export async function request(path: string, init: RequestInit = {}) {
	const headers = new Headers(init.headers)
	if (!headers.has("origin")) headers.set("origin", origin)
	const response = await app.handle(
		new Request(`${origin}${path}`, {
			...init,
			headers,
		}),
	)
	const text = await response.text()
	const body = text ? JSON.parse(text) : null
	return { response, body }
}

export async function signUp(name: string, email: string, password = "Sup3rSecret!") {
	const result = await request("/api/auth/sign-up/email", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ name, email, password }),
	})
	if (result.response.status !== 200) {
		throw new Error(`sign-up failed: ${result.response.status} ${JSON.stringify(result.body)}`)
	}
	const token = result.response.headers.get("set-auth-token")
	if (!token) throw new Error("Missing set-auth-token")
	return { token, user: result.body.user as { id: string; email: string; name: string } }
}
