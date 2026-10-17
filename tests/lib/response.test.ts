import { describe, expect, it } from "bun:test"

import { ok, okList, paginatedPage, toLimitOffset } from "../../src/lib/response"

describe("lib.response", () => {
	it("builds a success envelope", () => {
		expect(ok({ id: "1" })).toEqual({
			code: "OK",
			message: "Success",
			data: { id: "1" },
		})
		expect(ok({ id: "1" }, { code: "CREATED", message: "Done" })).toEqual({
			code: "CREATED",
			message: "Done",
			data: { id: "1" },
		})
	})

	it("builds a paginated list success envelope", () => {
		expect(paginatedPage(["a", "b"], 10, { page: 3, pageSize: 2 })).toEqual({
			code: "OK",
			message: "Success",
			data: {
				items: ["a", "b"],
				meta: { page: 3, pageSize: 2, total: 10, totalPages: 5 },
			},
		})
		expect(
			okList(["x"], { page: 1, pageSize: 20, total: 1, totalPages: 1 }, { message: "Berhasil" }),
		).toEqual({
			code: "OK",
			message: "Berhasil",
			data: {
				items: ["x"],
				meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
			},
		})
	})

	it("converts page/pageSize to limit/offset", () => {
		expect(toLimitOffset({ page: 1, pageSize: 20 })).toEqual({ limit: 20, offset: 0 })
		expect(toLimitOffset({ page: 3, pageSize: 10 })).toEqual({ limit: 10, offset: 20 })
	})
})
