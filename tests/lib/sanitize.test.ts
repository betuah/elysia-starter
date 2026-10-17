import { describe, expect, it } from "bun:test"

import {
	collapseWhitespace,
	escapeHtml,
	sanitizeMultiline,
	sanitizeText,
	stripHtml,
	stripNullBytes,
} from "../../src/lib/sanitize"

describe("lib.sanitize", () => {
	it("strips null bytes", () => {
		expect(stripNullBytes("a\0b\0c")).toBe("abc")
	})

	it("collapses whitespace", () => {
		expect(collapseWhitespace("  hello   world\t\n ")).toBe("hello world")
	})

	it("strips HTML tags", () => {
		expect(stripHtml("Hi <script>alert(1)</script> <b>there</b>")).toBe("Hi alert(1) there")
	})

	it("escapes HTML entities", () => {
		expect(escapeHtml(`<a href="x">y's & z</a>`)).toBe(
			"&lt;a href=&quot;x&quot;&gt;y&#39;s &amp; z&lt;/a&gt;",
		)
	})

	it("sanitizeText trims and collapses; does not strip HTML by default", () => {
		expect(sanitizeText("  Hello\0  <b>World</b>  ")).toBe("Hello <b>World</b>")
		expect(sanitizeText("   ")).toBe("")
		expect(sanitizeText("<p></p>", { stripHtml: true })).toBe("")
	})

	it("sanitizeMultiline preserves paragraphs", () => {
		expect(sanitizeMultiline("  Line 1  \n\n\n  Line   2  \r\n")).toBe("Line 1\n\nLine 2")
		expect(sanitizeMultiline("Say <em>hi</em>\0")).toBe("Say <em>hi</em>")
		expect(sanitizeMultiline("Say <em>hi</em>\0", { stripHtml: true })).toBe("Say hi")
	})
})
