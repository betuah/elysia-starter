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
 *
 * Built-in app resources beyond Better Auth defaults:
 * - `audit: ["list"]` — read activity log (`GET /api/audit`)
 */
const statement = {
	...defaultStatements,
	/** Activity / audit log (business events in `audit_log`). */
	audit: ["list"],
} as const

export const ac = createAccessControl(statement)

/** Authenticated member — no user admin actions. Own-data checks live in services. */
const userRole = ac.newRole({})

const adminRole = ac.newRole({
	user: [...adminAc.statements.user],
	session: [...adminAc.statements.session],
	audit: ["list"],
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

/**
 * Effective permission statements for a role string.
 * Aligns with `hasPermission`: comma-separated roles are OR-merged (union of actions).
 */
export function permissionsFor(role: string | null | undefined) {
	const names = (role ?? "user")
		.split(",")
		.map((item) => item.trim())
		.filter((item) => item.length > 0)

	const valid = names.filter(isRoleName)
	const roles: RoleName[] = valid.length > 0 ? valid : ["user"]

	const merged: Record<string, string[]> = {}
	for (const name of roles) {
		const statements = roleDefinitions[name].statements as Record<string, readonly string[]>
		for (const [resource, actions] of Object.entries(statements)) {
			const set = new Set([...(merged[resource] ?? []), ...actions])
			merged[resource] = [...set]
		}
	}
	return merged
}
