# syntax=docker/dockerfile:1
FROM golang:1.26-alpine AS build

WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/safebase-api ./cmd/api

FROM alpine:3.22
RUN apk add --no-cache ca-certificates tzdata \
    && addgroup -S safebase \
    && adduser -S -G safebase safebase \
    && mkdir -p /var/lib/mappening/uploads \
    && chown -R safebase:safebase /var/lib/mappening

COPY --from=build /out/safebase-api /usr/local/bin/safebase-api

USER safebase
ENV ADDR=0.0.0.0:8080 \
    MEDIA_UPLOAD_DIR=/var/lib/mappening/uploads
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -q -O- http://127.0.0.1:8080/api/health || exit 1
ENTRYPOINT ["/usr/local/bin/safebase-api"]
