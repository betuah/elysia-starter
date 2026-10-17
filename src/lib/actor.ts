import type { SessionUser } from "../auth"

export type Actor = {
	id: string
	name: string
	email: string
	role: string
	banned: boolean
}

export function toActor(user: SessionUser): Actor {
	return {
		id: user.id,
		name: user.name,
		email: user.email,
		role: "role" in user && typeof user.role === "string" ? user.role : "user",
		banned: "banned" in user && user.banned === true,
	}
}
