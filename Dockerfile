# syntax=docker/dockerfile:1

FROM node:26-slim AS web
WORKDIR /src

# Node.js 25 and later ship no Corepack, so pnpm is installed explicitly.
# PNPM_VERSION must stay equal to the pnpm pin in .mise.toml and to the
# packageManager field in the root package.json.
ARG PNPM_VERSION=12.21.0
RUN npm install -g "pnpm@${PNPM_VERSION}" && pnpm --version

# Copy workspace manifests only, so edits to application sources do not
# invalidate the dependency install layer below. --parents keeps the
# workspace directory layout (available from dockerfile frontend 1.7).
COPY --parents package.json pnpm-lock.yaml pnpm-workspace.yaml apps/*/package.json packages/*/package.json ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm --filter @opendraft/web build

FROM golang:1.27 AS bff
WORKDIR /src/apps/bff
COPY apps/bff/ .
ARG VERSION=0.0.0-dev
RUN CGO_ENABLED=0 go build -trimpath -ldflags "-s -w -X main.Version=${VERSION}" -o /out/bff .

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=bff /out/bff /bff
COPY --from=web /src/apps/web/dist /srv/web
ENV BFF_ADDR=:8080 BFF_STATIC_DIR=/srv/web
EXPOSE 8080
USER nonroot
HEALTHCHECK CMD ["/bff","healthcheck"]
ENTRYPOINT ["/bff"]
