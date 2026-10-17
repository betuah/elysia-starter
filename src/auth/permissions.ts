import { createAccessControl } from "better-auth/plugins/access"
import { adminAc, defaultStatements } from "better-auth/plugins/admin/access"

/**
 * Global role ACL (Better Auth admin plugin).
 *
 * Roles here answer "can this role perform this admin/resource action?"
 * They do NOT answer "is this row mine?" — that is ownership (see `assertOwnerOrPermission`).
 *
 * To add a role/permission:
 * 1. Extend `statement` with a resource and actions (or reuse defaultStatements.user/session).
 * 2. Grant actions on `userRole` / `adminRole` via `ac.newRole({ ... })`.
 * 3. Export the role in `roleDefinitions` so the admin plugin and `hasPermission` see it.
 * 4. Restart the API; existing users keep their `role` column until you promote them.
 */
const statement = {
	...defaultStatements,
} as const

export const ac = createAccessControl(statement)

/** Authenticated member — no user admin actions. Own-data checks live in services. */
const userRole = ac.newRole({})

const adminRole = ac.newRole({
	user: [...adminAc.statements.user],
	session: [...adminAc.statements.session],
})

export const roleDefinitions = {
	user: userRole,
	admin: adminRole,
}

export type RoleName = keyof typeof roleDefinitions
export type PermissionRequest = Parameters<typeof userRole.authorize>[0]

export const roleNames = Object.keys(roleDefinitions) as RoleName[]

export function isRoleName(value: string): value is RoleName {
	return value in roleDefinitions
}

export function hasPermission(role: string | null | undefined, request: PermissionRequest) {
	const names = (role ?? "user")
		.split(",")
		.map((item) => item.trim())
		.filter((item) => item.length > 0)

	return names.some((name) => {
		if (!isRoleName(name)) return false
		return roleDefinitions[name].authorize(request).success
	})
}

export function permissionsFor(role: string | null | undefined) {
	const name = role && isRoleName(role) ? role : "user"
	return roleDefinitions[name].statements
}
