export function createRateLimiter(options: { windowMs: number; max: number }) {
	const hits = new Map<string, { count: number; resetAt: number }>()

	return {
		check(key: string, now = Date.now()) {
			const current = hits.get(key)
			if (!current || current.resetAt <= now) {
				hits.set(key, { count: 1, resetAt: now + options.windowMs })
				return { allowed: true, remaining: Math.max(options.max - 1, 0), resetAt: now + options.windowMs }
			}

			current.count += 1
			const allowed = current.count <= options.max
			return {
				allowed,
				remaining: Math.max(options.max - current.count, 0),
				resetAt: current.resetAt,
			}
		},
		reset() {
			hits.clear()
		},
	}
}
