import { auth } from "../auth"
import { env } from "../env"
import { userRepository } from "../modules/user/repository"

async function ensureUser(options: {
	email: string
	password: string
	name: string
	role: "admin" | "user"
}) {
	const existing = await userRepository.findByEmail(options.email)

	if (existing) {
		if (existing.role !== options.role) {
			await userRepository.update(existing.id, { role: options.role })
			console.log(`Updated ${options.email} role → ${options.role}.`)
		} else {
			console.log(`${options.role} ${options.email} already exists.`)
		}
		return
	}

	const result = await auth.api.signUpEmail({
		body: {
			name: options.name,
			email: options.email,
			password: options.password,
		},
		headers: new Headers({ origin: env.BETTER_AUTH_URL }),
	})

	if (!result.user) {
		throw new Error(`Could not create user ${options.email}.`)
	}

	await userRepository.update(result.user.id, {
		role: options.role,
		emailVerified: true,
	})

	console.log(`Created ${options.role} ${options.email}.`)
}

await ensureUser({
	email: env.ADMIN_EMAIL,
	password: env.ADMIN_PASSWORD,
	name: env.ADMIN_NAME,
	role: "admin",
})

await ensureUser({
	email: env.USER_EMAIL,
	password: env.USER_PASSWORD,
	name: env.USER_NAME,
	role: "user",
})

console.log("Change ADMIN_PASSWORD / USER_PASSWORD before exposing this service.")
