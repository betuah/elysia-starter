import { Elysia } from "elysia"

import { errorModel } from "./error"
import { pageMeta, pageQuery } from "./pagination"

export { errorModel } from "./error"
export { pageMeta, pageQuery, paginatedDataSchema } from "./pagination"
export { successSchema } from "./success"

/** Shared OpenAPI / route models (`common.*`). */
export const sharedModels = new Elysia({ name: "app.models" }).model({
	"common.Error": errorModel,
	"common.PageQuery": pageQuery,
	"common.PageMeta": pageMeta,
})
