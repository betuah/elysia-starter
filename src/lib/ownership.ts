import { hasPermission, type PermissionRequest } from "../auth/permissions"
import { env } from "../env"
import { t } from "../i18n"
import type { Actor } from "./actor"
import { fail } from "./error"

/**
 * Ownership (“data milik sendiri”) vs role ACL.
 *
 * - Role ACL (`hasPermission`): can the actor's role perform an admin/resource action?
 * - Ownership: is the actor the owner of this row? Used so regular users only touch
 *   their own profile (or future resources filtered by `authorId = actor.id`).
 *
 * Pass a permission that grants bypass (e.g. `{ user: ["get"] }` for viewing others,
 * `{ user: ["update"] }` for admin updates). If the actor owns the resource, allow.
 * Otherwise require the permission — else 403.
 */
export function assertOwnerOrPermission(
	actor: Actor,
	resourceOwnerId: string,
	permission: PermissionRequest,
	message = t(env.DEFAULT_LOCALE, "errors.ownDataOnly"),
): void {
	if (actor.id === resourceOwnerId) return
	if (hasPermission(actor.role, permission)) return
	fail(403, { code: "FORBIDDEN", message })
}

/** True when the actor owns the resource or has the given permission. */
export function isOwnerOrHasPermission(
	actor: Actor,
	resourceOwnerId: string,
	permission: PermissionRequest,
): boolean {
	if (actor.id === resourceOwnerId) return true
	return hasPermission(actor.role, permission)
}
