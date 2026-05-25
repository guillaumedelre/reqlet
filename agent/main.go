package main

import (
	"embed"
	"io/fs"
	"log"
	"net/http"
	"os"
)

//go:embed all:web
var webFS embed.FS

func main() {
	addr := ":8080"
	if v := os.Getenv("REQLET_ADDR"); v != "" {
		addr = v
	}

	sub, err := fs.Sub(webFS, "web")
	if err != nil {
		log.Fatal(err)
	}

	mux := http.NewServeMux()
	mux.Handle("/api/", http.NotFoundHandler()) // REST API routes (Phase 2.15)
	mux.Handle("/", http.FileServer(http.FS(sub)))

	log.Printf("reqlet-agent listening on %s", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatal(err)
	}
}
