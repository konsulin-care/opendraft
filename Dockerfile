# syntax=docker/dockerfile:1

FROM node:lts-slim AS web
WORKDIR /src
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile && pnpm --filter @opendraft/web build

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
