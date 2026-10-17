import { describe, expect, it } from "bun:test"

import {
	negotiateLocale,
	parseAcceptLanguage,
	readCookie,
	t,
} from "../../src/i18n"

describe("i18n.t", () => {
	it("returns English and Indonesian catalog strings", () => {
		expect(t("en", "errors.userNotFound")).toBe("User not found")
		expect(t("id", "errors.userNotFound")).toBe("Pengguna tidak ditemukan")
	})

	it("interpolates params and falls back for unknown locales", () => {
		expect(t("en", "errors.unauthorized")).toBe("Authentication required")
		expect(t("fr", "errors.unauthorized")).toBe("Authentication required")
	})
})

describe("i18n.negotiateLocale", () => {
	it("prefers query over cookie over Accept-Language over default", () => {
		expect(
			negotiateLocale({
				query: "id",
				cookie: "en",
				acceptLanguage: "en-US,en;q=0.9",
			}),
		).toBe("id")

		expect(
			negotiateLocale({
				query: null,
				cookie: "id",
				acceptLanguage: "en-US,en;q=0.9",
			}),
		).toBe("id")

		expect(
			negotiateLocale({
				query: null,
				cookie: null,
				acceptLanguage: "id-ID,id;q=0.9,en;q=0.8",
			}),
		).toBe("id")

		expect(
			negotiateLocale({
				query: null,
				cookie: null,
				acceptLanguage: "fr-FR,fr;q=0.9",
			}),
		).toBe("en")
	})

	it("normalizes region tags and ignores unsupported query values", () => {
		expect(negotiateLocale({ query: "id-ID" })).toBe("id")
		expect(
			negotiateLocale({
				query: "xx",
				cookie: "en",
			}),
		).toBe("en")
	})
})

describe("i18n.parseAcceptLanguage", () => {
	it("orders tags by quality", () => {
		expect(parseAcceptLanguage("en;q=0.5,id;q=0.9")).toEqual(["id", "en"])
	})
})

describe("i18n.readCookie", () => {
	it("reads a named cookie value", () => {
		expect(readCookie("session=abc; locale=id; path=/", "locale")).toBe("id")
		expect(readCookie(null, "locale")).toBeNull()
	})
})
