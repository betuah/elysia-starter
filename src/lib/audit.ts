import { db } from "../db"
import { auditLog } from "../db/schema"

export type AuditInput = {
	actorUserId?: string | null
	action: string
	resourceType?: string | null
	resourceId?: string | null
	metadata?: Record<string, unknown> | null
	ip?: string | null
	userAgent?: string | null
}

/** Best-effort IP / User-Agent from request headers (proxy-aware when present). */
export function auditContextFromHeaders(headers: Headers): Pick<AuditInput, "ip" | "userAgent"> {
	const forwarded = headers.get("x-forwarded-for")
	const ip =
		forwarded?.split(",")[0]?.trim() ||
		headers.get("x-real-ip")?.trim() ||
		null
	return {
		ip,
		userAgent: headers.get("user-agent"),
	}
}

/**
 * Persist a business-event audit row.
 * Failures are logged and swallowed so the primary request is never blocked.
 */
export async function recordAudit(input: AuditInput): Promise<void> {
	try {
		await db.insert(auditLog).values({
			id: crypto.randomUUID(),
			actorUserId: input.actorUserId ?? null,
			action: input.action,
			resourceType: input.resourceType ?? null,
			resourceId: input.resourceId ?? null,
			metadata: input.metadata ?? null,
			ip: input.ip ?? null,
			userAgent: input.userAgent ?? null,
		})
	} catch (error) {
		console.error("[audit] failed to record", {
			action: input.action,
			error: error instanceof Error ? error.message : String(error),
		})
	}
}
