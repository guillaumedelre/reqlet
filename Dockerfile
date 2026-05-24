FROM golang:1.25-alpine AS go-builder
WORKDIR /app
COPY go.mod ./
RUN go mod download
COPY . .
RUN go build -o /dist/reqlet-cli ./cli

FROM alpine:3.21
RUN apk add --no-cache ca-certificates
COPY --from=go-builder /dist/reqlet-cli /usr/local/bin/reqlet-cli
ENTRYPOINT ["reqlet-cli"]
