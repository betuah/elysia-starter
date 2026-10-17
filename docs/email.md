# Email (React Email + SMTP)

Auth flows (password reset, email verification) send mail through `src/lib/email/`.

| Piece | Location |
| --- | --- |
| Templates | `src/emails/` (React Email) |
| Preview | `bun run email` |
| Transport | nodemailer via `SMTP_*` + `EMAIL_FROM` |
| Without `SMTP_HOST` | `console.log` mock |

Env: `EMAIL_FROM`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`.

Related auth features: forgot/reset password, email verification (`sendOnSignUp`), optional `REQUIRE_EMAIL_VERIFICATION=true`. See [auth.md](./auth.md).
