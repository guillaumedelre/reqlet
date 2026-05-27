package main

import (
	"embed"
	"encoding/json"
	"io/fs"
	"log"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"
	"time"
)

//go:embed all:web
var webFS embed.FS

type server struct {
	collections  *jsonStore
	environments *jsonStore
}

func (s *server) newMux(webContent fs.FS) http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("/api/health", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	})
	mux.HandleFunc("/api/send", handleSend)

	mux.HandleFunc("GET /api/collections", s.listCollections)
	mux.HandleFunc("POST /api/collections", s.createCollection)
	mux.HandleFunc("GET /api/collections/{id}", s.getCollection)
	mux.HandleFunc("PUT /api/collections/{id}", s.updateCollection)
	mux.HandleFunc("DELETE /api/collections/{id}", s.deleteCollection)

	mux.HandleFunc("GET /api/environments", s.listEnvironments)
	mux.HandleFunc("POST /api/environments", s.createEnvironment)
	mux.HandleFunc("GET /api/environments/{id}", s.getEnvironment)
	mux.HandleFunc("PUT /api/environments/{id}", s.updateEnvironment)
	mux.HandleFunc("DELETE /api/environments/{id}", s.deleteEnvironment)

	mux.Handle("/api/", http.NotFoundHandler())
	mux.Handle("/", spaHandler(webContent))
	return mux
}

// spaHandler serves static files and falls back to index.html for SPA routes.
// Paths with a file extension that don't exist return 404 (missing asset).
// Paths without extension that don't exist return index.html (client-side route).
func spaHandler(content fs.FS) http.Handler {
	fileServer := http.FileServer(http.FS(content))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		p := strings.TrimPrefix(path.Clean("/"+r.URL.Path), "/")
		if p == "" {
			p = "."
		}
		if _, err := content.Open(p); err == nil {
			fileServer.ServeHTTP(w, r)
			return
		}
		if path.Ext(p) != "" {
			http.NotFound(w, r)
			return
		}
		// SPA route: serve index.html directly to avoid FileServer redirect logic.
		data, err := fs.ReadFile(content, "index.html")
		if err != nil {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_, _ = w.Write(data)
	})
}

func main() {
	addr := ":8080"
	if v := os.Getenv("REQLET_ADDR"); v != "" {
		addr = v
	}

	wp, err := workspacePath()
	if err != nil {
		log.Fatal(err)
	}

	colStore, err := newJSONStore(filepath.Join(wp, "collections"))
	if err != nil {
		log.Fatal(err)
	}
	envStore, err := newJSONStore(filepath.Join(wp, "environments"))
	if err != nil {
		log.Fatal(err)
	}

	sub, err := fs.Sub(webFS, "web")
	if err != nil {
		log.Fatal(err)
	}

	s := &server{collections: colStore, environments: envStore}

	srv := &http.Server{
		Addr:         addr,
		Handler:      s.newMux(sub),
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}
	log.Printf("reqlet-agent listening on %s", addr) //nolint:gosec // addr is from env var under user control
	if err := srv.ListenAndServe(); err != nil {
		log.Fatal(err)
	}
}
