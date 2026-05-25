package main

import (
	"embed"
	"encoding/json"
	"io/fs"
	"log"
	"net/http"
	"os"
	"time"
)

//go:embed all:web
var webFS embed.FS

func newMux(webContent fs.FS) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/health", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	})
	mux.HandleFunc("/api/send", handleSend)
	mux.Handle("/api/", http.NotFoundHandler())
	mux.Handle("/", http.FileServer(http.FS(webContent)))
	return mux
}

func main() {
	addr := ":8080"
	if v := os.Getenv("REQLET_ADDR"); v != "" {
		addr = v
	}

	sub, err := fs.Sub(webFS, "web")
	if err != nil {
		log.Fatal(err)
	}

	srv := &http.Server{
		Addr:         addr,
		Handler:      newMux(sub),
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}
	log.Printf("reqlet-agent listening on %s", addr) //nolint:gosec // addr is from env var under user control
	if err := srv.ListenAndServe(); err != nil {
		log.Fatal(err)
	}
}
