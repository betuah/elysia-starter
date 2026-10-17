# API response contract

All **Elysia module** routes use a uniform envelope. **Better Auth** (`/api/auth/*` via `auth.handler`) keeps its own shape — do not wrap it.

## Success (always)

```ts
{ code: string, message: string, data: T }
```

## List `data`

```ts
{
  items: T[],
  meta: { page: number, pageSize: number, total: number, totalPages: number }
}
```

## Error (always — no `data`)

```ts
{ code: string, message: string }
```

## Validation

`code: "VALIDATION"`, HTTP 422, with a per-field list (optional on other errors):

```ts
{
  code: "VALIDATION",
  message: string, // i18n `errors.validation`
  errors: [{ field: string, message: string }] // e.g. "body.name", "query.pageSize"
}
```

## Helpers and schemas

- Helpers: `ok(data)`, `okList(items, meta)`, `paginatedPage(items, total, { page, pageSize })` in `src/lib/response.ts`
- Errors: `fail` / `failT(locale, status, code, key)` in `src/lib/error.ts`
- Schemas: `successSchema(data)`, `paginatedDataSchema(item)`, `common.PageQuery` (`page` / `pageSize`), `common.Error` in `src/models/`
- Default success message: i18n `common.success`

Module models should wrap payloads with `successSchema(...)` so OpenAPI matches the envelope. See [modules.md](./modules.md) and [security.md](./security.md).
