import { describe, expect, it } from "bun:test"

import { paginated } from "../../src/lib/response"

describe("lib.response", () => {
	it("builds a paginated list envelope", () => {
		expect(paginated(["a", "b"], 10, { limit: 2, offset: 4 })).toEqual({
			items: ["a", "b"],
			total: 10,
			limit: 2,
			offset: 4,
		})
	})
})
