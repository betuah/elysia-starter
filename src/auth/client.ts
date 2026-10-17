import { createAuthClient } from "better-auth/client"
import { adminClient, oneTapClient } from "better-auth/client/plugins"

import { env } from "../env"
import { ac, roleDefinitions } from "./permissions"

const plugins = [
	adminClient({
		ac,
		roles: roleDefinitions,
	}),
	...(env.GOOGLE_ENABLED && env.AUTH_GOOGLE_ONE_TAP_ENABLED && env.GOOGLE_CLIENT_ID
		? [
				oneTapClient({
					clientId: env.GOOGLE_CLIENT_ID,
					autoSelect: false,
					cancelOnTapOutside: true,
					context: "signin",
					promptOptions: {
						baseDelay: 1000,
						maxAttempts: 5,
					},
				}),
			]
		: []),
]

/** Optional server-side / script client (not the Vite React app). */
export const authClient = createAuthClient({
	baseURL: env.BETTER_AUTH_URL,
	plugins,
})
