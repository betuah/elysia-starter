import { describe, expect, it, spyOn } from "bun:test"
import * as React from "react"

import EmailVerificationEmail from "../../src/emails/email-verification"
import PasswordResetEmail from "../../src/emails/password-reset"
import { isSmtpConfigured, renderEmail, sendEmail } from "../../src/lib/email"

describe("lib.email", () => {
	it("treats missing SMTP_HOST as unconfigured", () => {
		expect(isSmtpConfigured(undefined)).toBe(false)
		expect(isSmtpConfigured("")).toBe(false)
		expect(isSmtpConfigured("smtp.example.com")).toBe(true)
	})

	it("mocks to console when SMTP is not configured", async () => {
		const log = spyOn(console, "log").mockImplementation(() => {})
		try {
			await sendEmail({
				to: "user@example.com",
				subject: "Test",
				html: "<p>hello</p>",
				text: "hello",
			})
			expect(log).toHaveBeenCalled()
			const [label, payload] = log.mock.calls[0] as [string, Record<string, unknown>]
			expect(label).toBe("[email:mock]")
			expect(payload.to).toBe("user@example.com")
			expect(payload.subject).toBe("Test")
		} finally {
			log.mockRestore()
		}
	})

	it("renders password-reset React email", async () => {
		const html = await renderEmail(
			React.createElement(PasswordResetEmail, {
				name: "Ada <script>",
				url: "https://example.com/reset?token=abc",
			}),
		)
		expect(html).toContain("Hi Ada &lt;script&gt;")
		expect(html).toContain('href="https://example.com/reset?token=abc"')
		expect(html).toContain("Reset your password")
	})

	it("renders email-verification React email", async () => {
		const html = await renderEmail(
			React.createElement(EmailVerificationEmail, {
				name: "Bob",
				url: "https://example.com/verify?token=xyz",
			}),
		)
		expect(html).toContain("Hi Bob")
		expect(html).toContain('href="https://example.com/verify?token=xyz"')
		expect(html).toContain("Verify your email")
	})
})
