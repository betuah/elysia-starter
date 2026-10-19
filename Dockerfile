# Production image aligned with https://elysiajs.com/patterns/deploy.html
# Multi-stage: compile Bun binary → distroless runtime.
#
# `postgres` is marked --external so the driver loads from node_modules at
# runtime (native/dynamic requires break when fully bundled).

FROM oven/bun:1 AS build

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY tsconfig.json drizzle.config.ts ./
COPY src ./src
COPY migration ./migration

ENV NODE_ENV=production

RUN bun build \
	--compile \
	--minify-whitespace \
	--minify-syntax \
	--target bun \
	--external postgres \
	--outfile server \
	src/index.ts

# Production node_modules for external packages (postgres) only.
RUN bun install --production --frozen-lockfile

FROM gcr.io/distroless/base-debian12

WORKDIR /app

COPY --from=build /app/server /app/server
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/package.json /app/package.json
COPY --from=build /app/migration /app/migration

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

EXPOSE 3000

# Distroless has no shell; binary is the entrypoint.
CMD ["/app/server"]
