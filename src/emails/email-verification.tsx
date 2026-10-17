import * as React from "react"
import { Link, Section, Tailwind, Text } from "@react-email/components"

export type EmailVerificationEmailProps = {
	name: string
	url: string
}

export default function EmailVerificationEmail({
	name,
	url,
}: EmailVerificationEmailProps) {
	return (
		<Tailwind>
			<Section className="flex justify-center items-center w-full min-h-screen font-sans bg-slate-50">
				<Section className="flex flex-col w-full max-w-md rounded-2xl px-8 py-6 bg-white">
					<Text className="text-xs font-medium text-slate-500 m-0">
						Email verification
					</Text>
					<Text className="text-xl font-semibold text-slate-900 mt-2 mb-0">
						{`Hi ${name},`}
					</Text>
					<Text className="text-slate-600 mt-3 mb-0">
						Confirm your email address to finish setting up your account.
					</Text>
					<Text className="mt-5 mb-0">
						<Link
							href={url}
							className="text-sky-700 font-medium underline"
						>
							Verify your email
						</Link>
					</Text>
					<Text className="text-slate-400 text-xs mt-6 mb-0">
						If you did not create an account, you can ignore this email.
					</Text>
				</Section>
			</Section>
		</Tailwind>
	)
}

EmailVerificationEmail.PreviewProps = {
	name: "Ada Lovelace",
	url: "https://example.com/verify-email?token=preview",
} satisfies EmailVerificationEmailProps
