FROM golang:1.25-alpine AS go-builder
WORKDIR /app
COPY go.mod ./
RUN go mod download
COPY . .
RUN go build -o /dist/reqlet ./cli/...

FROM alpine:3.21
RUN apk add --no-cache ca-certificates
COPY --from=go-builder /dist/reqlet /usr/local/bin/reqlet
ENTRYPOINT ["reqlet"]
