import type { ReactElement } from "react"
import { renderToReadableStream } from "react-dom/server"

/**
 * Render a React Email component to an HTML string for SMTP transport.
 *
 * Elysia docs use `renderToStaticMarkup`; with `@react-email/components` Tailwind
 * under React 19 that suspends, so we await `renderToReadableStream` from the
 * same `react-dom/server` package instead.
 */
export async function renderEmail(component: ReactElement): Promise<string> {
	const stream = await renderToReadableStream(component)
	await stream.allReady
	return await new Response(stream).text()
}
