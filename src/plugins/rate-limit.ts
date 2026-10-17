export function createRateLimiter(options: { windowMs: number; max: number }) {
	const hits = new Map<string, { count: number; resetAt: number }>()
	let lastSweepAt = 0

	function evictExpired(now: number) {
		// Evict expired windows so the map cannot grow forever under many unique keys.
		if (now - lastSweepAt < options.windowMs) return
		lastSweepAt = now
		for (const [key, entry] of hits) {
			if (entry.resetAt <= now) hits.delete(key)
		}
	}

	return {
		check(key: string, now = Date.now()) {
			evictExpired(now)

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
		/** Test / ops helper — remove expired entries immediately. */
		sweep(now = Date.now()) {
			lastSweepAt = 0
			evictExpired(now)
		},
		size() {
			return hits.size
		},
		reset() {
			hits.clear()
			lastSweepAt = 0
		},
	}
}
