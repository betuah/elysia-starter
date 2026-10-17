export { account, session, ssoProvider, user, verification } from "./auth"
export { accountRelations, sessionRelations, userRelations } from "./relations"

import { account, session, ssoProvider, user, verification } from "./auth"

/** Tables passed to Better Auth `drizzleAdapter`. */
export const authSchema = { user, session, account, verification, ssoProvider }
