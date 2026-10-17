import type { ElysiaConfig } from "elysia"

import { env } from "../env"
import { stripNullBytes } from "../lib/sanitize"

/**
 * Bun `serve` options applied via `new Elysia({ serve })`.
 *
 * - `maxRequestBodySize` — bytes from `MAX_BODY_SIZE_MIB` (or legacy `MAX_BODY_SIZE`); default 1 MiB
 * - `idleTimeout` — seconds of connection inactivity before Bun closes the socket
 *   (Bun max 255; `0` disables). Elysia's Bun adapter also defaults this to 30.
 *
 * Not wired: `maxHeaderSize` / `keepAliveTimeout` — not on Bun.Serve in this runtime.
 */
export const serveOptions = {
	maxRequestBodySize: env.MAX_BODY_SIZE,
	idleTimeout: env.IDLE_TIMEOUT,
	/**
	 * SO_REUSEPORT — required for multi-process listen on the same port (cluster).
	 * Elysia already defaults this to true on Bun; set explicitly for clarity.
	 * Reliable on Linux; see README cluster notes for other platforms.
	 */
	reusePort: true,
} as const satisfies NonNullable<ElysiaConfig<"">["serve"]>

/**
 * Root Elysia constructor options (name + server limits + string sanitize).
 *
 * `sanitize` intercepts every non-`trusted` `t.String` during validation.
 * Primary use here is the **write path** (request body/query/params): strip NULs +
 * `Bun.escapeHTML`. Response / password / URL fields should set `trusted: true` so
 * JSON clients are not double-escaped and credentials stay intact. See README Security.
 */
export const elysiaOptions = {
	name: "elysia-starter",
	serve: serveOptions,
	sanitize: [stripNullBytes, (value: string) => Bun.escapeHTML(value)],
} satisfies ElysiaConfig<"">
