# Auth, ACL, and ownership

Better Auth is mounted at `/api/auth/*` via `auth.handler` in `src/app.ts`. Elysia modules use the `authPlugin` macros (`auth`, `permission`) — they do **not** wrap Better Auth responses in the app envelope.

## Roles and permissions

Edit `src/auth/permissions.ts`:

1. Extend `statement` (or use `defaultStatements` from the admin plugin).
2. Assign actions to roles with `ac.newRole({ ... })`.
3. Export them in `roleDefinitions` (`user`, `admin`, …).
4. The admin plugin in `src/auth/index.ts` already uses `ac` + `roleDefinitions`.
5. Restart the API. Existing users keep their `role` column until promoted.

Example — add a `note` resource:

```ts
const statement = {
  ...defaultStatements,
  note: ["create", "read", "update", "delete", "moderate"],
} as const

const userRole = ac.newRole({ note: ["create", "read", "update", "delete"] })
const adminRole = ac.newRole({
  note: ["create", "read", "update", "delete", "moderate"],
  user: [...adminAc.statements.user],
  session: [...adminAc.statements.session],
})
```

Route macro: `permission: { note: ["create"] }`.

## Ownership vs role ACL

| Concept | Question | Where |
| --- | --- | --- |
| **Role ACL** | Can this role perform an admin/resource action? | `hasPermission` / macro `permission` |
| **Ownership** | Does this row belong to the actor? | `assertOwnerOrPermission` in the service |

- Regular user: `GET/PATCH /api/users/me` (own profile). Cannot list/ban/delete/set-role.
- Admin: list, create/invite, set-role, ban/unban, delete.

Helper: `src/lib/ownership.ts`.

Pattern for a new resource module:

```ts
// Filter query: own rows only, unless moderate/list-all
if (!hasPermission(actor.role, { note: ["moderate"] })) {
  // where authorId = actor.id
}
assertOwnerOrPermission(actor, row.authorId, { note: ["moderate"] })
```

## Feature matrix

| Feature | Status | Env / notes |
| --- | --- | --- |
| Login / signup email+password | ✅ | — |
| Session cookie + bearer (`set-auth-token`) | ✅ | `TRUSTED_ORIGINS` must include the client origin |
| Forgot / reset password | ✅ | React Email → SMTP (`EMAIL_FROM` + `SMTP_*`) or console mock |
| Email verification | ✅ | React Email; `sendOnSignUp`; optional `REQUIRE_EMAIL_VERIFICATION=true` |
| Invite / create user | ✅ | `POST /api/users` (admin) → Better Auth `createUser` |
| Promote / demote admin | ✅ | `PATCH /api/users/:id/role` |
| Ban / unban | ✅ | `POST /api/users/:id/ban|unban` (+ `/api/auth/admin/*`) |
| Delete user | ✅ | `DELETE /api/users/:id` |
| Update own profile | ✅ | `PATCH /api/users/me` (name, image URL) |
| Upload own avatar | ✅ | `POST /api/users/me/avatar` (multipart → `getStorage().put`) |
| Google sign-in | ⚙️ | `AUTH_GOOGLE_ENABLED=true` + `GOOGLE_CLIENT_*` |
| Google One Tap | ⚙️ | + `AUTH_GOOGLE_ONE_TAP_ENABLED=true` (FedCM) |
| Enterprise SSO | ⚙️ | `AUTH_SSO_ENABLED=true` + client + issuer/discovery ([SSO plugin](https://better-auth.com/docs/plugins/sso)) |
| Provider probe | ✅ | `GET /api/auth/providers` (no secrets) + absolute Google/SSO URIs |
| Real email send | ⚙️ | See [email.md](./email.md) |

## Auth providers (env toggles)

| Toggle | Also need | Effect |
| --- | --- | --- |
| `AUTH_GOOGLE_ENABLED=true` | `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` | `socialProviders.google` |
| `AUTH_GOOGLE_ONE_TAP_ENABLED=true` | Google effective | Plugin `oneTap` |
| `AUTH_SSO_ENABLED=true` | `AUTH_SSO_CLIENT_ID/SECRET` + `AUTH_SSO_ISSUER` (or discovery) + domain | Plugin `@better-auth/sso` `defaultSSO` |

- Prefer `AUTH_SSO_*`. Legacy `AUTH_OIDC_*` names still work as a silent fallback if `AUTH_SSO_*` is unset.
- Discovery: set `AUTH_SSO_ISSUER` and/or `AUTH_SSO_DISCOVERY_URL`.
- Schema: SSO adds table `ssoProvider`. After pull, run `bun run db:migrate` (or restart with `RUN_MIGRATIONS=true`).

## Google / SSO registration URIs

Register these with Google Cloud Console or your enterprise IdP. Docs: [Google](https://better-auth.com/docs/authentication/google), [SSO plugin](https://better-auth.com/docs/plugins/sso). `providerId` defaults to `AUTH_SSO_PROVIDER_ID` (`oidc`).

| Purpose | Path |
| --- | --- |
| Google authorized redirect | `{BETTER_AUTH_URL}/api/auth/callback/google` |
| SSO redirect/callback | `{BETTER_AUTH_URL}/api/auth/sso/callback/{providerId}` |
| SSO sign-in | `POST {BETTER_AUTH_URL}/api/auth/sign-in/sso` |
| Sign-out | `POST {BETTER_AUTH_URL}/api/auth/sign-out` |

`GET /api/auth/providers` returns the same values as absolute URIs under `google` and `sso` — no secrets.

See also: [security.md](./security.md), [storage.md](./storage.md) (avatar), [email.md](./email.md).
