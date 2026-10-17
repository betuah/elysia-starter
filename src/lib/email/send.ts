import nodemailer from "nodemailer"

import { env } from "../../env"

export type SendEmailInput = {
	to: string
	subject: string
	html: string
	text?: string
}

/** True when enough SMTP config is present to send real mail. */
export function isSmtpConfigured(host: string | undefined = env.SMTP_HOST): boolean {
	return Boolean(host)
}

/**
 * Send transactional email via SMTP when `SMTP_HOST` is set;
 * otherwise logs a mock payload to the console (dev-friendly MVP).
 */
export async function sendEmail(input: SendEmailInput): Promise<void> {
	const from = env.EMAIL_FROM

	if (!isSmtpConfigured()) {
		console.log("[email:mock]", {
			from,
			to: input.to,
			subject: input.subject,
			text: input.text,
			html: input.html.slice(0, 500) + (input.html.length > 500 ? "…" : ""),
		})
		return
	}

	const transport = nodemailer.createTransport({
		host: env.SMTP_HOST,
		port: env.SMTP_PORT,
		secure: env.SMTP_SECURE,
		auth:
			env.SMTP_USER || env.SMTP_PASS
				? {
						user: env.SMTP_USER,
						pass: env.SMTP_PASS,
					}
				: undefined,
		tls:
			env.SMTP_REJECT_UNAUTHORIZED === false
				? { rejectUnauthorized: false }
				: undefined,
	})

	try {
		await transport.sendMail({
			from,
			to: input.to,
			subject: input.subject,
			html: input.html,
			text: input.text,
		})
	} finally {
		transport.close()
	}
}
