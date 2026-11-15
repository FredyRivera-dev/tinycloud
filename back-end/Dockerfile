# syntax=docker/dockerfile:1

FROM golang:1.27-alpine AS builder
WORKDIR /src

# Cache module downloads separately from source changes.
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build \
    -trimpath -ldflags="-s -w" \
    -o /out/tinycloud-api ./cmd/api

FROM alpine:3
RUN apk add --no-cache ca-certificates tzdata \
    && addgroup -S -g 10001 tinycloud \
    && adduser -S -D -H -u 10001 -G tinycloud tinycloud

COPY --from=builder /out/tinycloud-api /usr/local/bin/tinycloud-api

USER tinycloud
EXPOSE 5950

HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=6 \
    CMD wget -q -O /dev/null http://127.0.0.1:5950/healthz || exit 1

ENTRYPOINT ["/usr/local/bin/tinycloud-api"]
