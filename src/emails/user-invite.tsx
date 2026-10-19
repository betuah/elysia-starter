import * as React from "react"
import { Link, Section, Tailwind, Text } from "@react-email/components"

export type UserInviteEmailProps = {
	name: string
	url: string
	appName: string
	inviterName?: string
}

export default function UserInviteEmail({
	name,
	url,
	appName,
	inviterName,
}: UserInviteEmailProps) {
	const from = inviterName ? ` from ${inviterName}` : ""
	return (
		<Tailwind>
			<Section className="flex justify-center items-center w-full min-h-screen font-sans bg-slate-50">
				<Section className="flex flex-col w-full max-w-md rounded-2xl px-8 py-6 bg-white">
					<Text className="text-xs font-medium text-slate-500 m-0">
						Invitation
					</Text>
					<Text className="text-xl font-semibold text-slate-900 mt-2 mb-0">
						{`Hi ${name},`}
					</Text>
					<Text className="text-slate-600 mt-3 mb-0">
						{`You have been invited${from} to join ${appName}. Click the link below to set your password and activate your account.`}
					</Text>
					<Text className="mt-5 mb-0">
						<Link
							href={url}
							className="text-sky-700 font-medium underline"
						>
							Accept invitation
						</Link>
					</Text>
					<Text className="text-slate-400 text-xs mt-6 mb-0">
						If you were not expecting this invitation, you can ignore this email.
					</Text>
				</Section>
			</Section>
		</Tailwind>
	)
}

UserInviteEmail.PreviewProps = {
	name: "Ada Lovelace",
	url: "https://example.com/api/auth/reset-password/preview?callbackURL=https%3A%2F%2Fexample.com%2Freset-password",
	appName: "Elysia Starter",
	inviterName: "Admin",
} satisfies UserInviteEmailProps
