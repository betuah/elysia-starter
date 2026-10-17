import { env } from "../env"

export type SendEmailInput = {
	to: string
	subject: string
	html: string
	text?: string
}

/**
 * Send transactional email. Uses Resend when `RESEND_API_KEY` is set;
 * otherwise logs a mock payload to the console (dev-friendly MVP).
 */
export async function sendEmail(input: SendEmailInput): Promise<void> {
	const from = env.EMAIL_FROM

	if (!env.RESEND_API_KEY) {
		console.log("[email:mock]", {
			from,
			to: input.to,
			subject: input.subject,
			text: input.text,
			html: input.html.slice(0, 500) + (input.html.length > 500 ? "…" : ""),
		})
		return
	}

	const response = await fetch("https://api.resend.com/emails", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${env.RESEND_API_KEY}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			from,
			to: [input.to],
			subject: input.subject,
			html: input.html,
			text: input.text,
		}),
	})

	if (!response.ok) {
		const body = await response.text()
		throw new Error(`Resend failed (${response.status}): ${body}`)
	}
}
