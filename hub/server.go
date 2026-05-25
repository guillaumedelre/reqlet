package main

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

// Server holds the HTTP router and address configuration.
type Server struct {
	router *chi.Mux
	addr   string
}

// NewServer creates a configured Server ready to serve.
func NewServer(addr string) *Server {
	s := &Server{addr: addr}
	s.router = chi.NewRouter()
	s.router.Use(middleware.Recoverer)
	s.routes()
	return s
}

func (s *Server) routes() {
	s.router.Get("/api/health", s.handleHealth)
}

func (s *Server) handleHealth(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

// Start binds the server to s.addr and blocks until an error occurs.
func (s *Server) Start() error {
	srv := &http.Server{
		Addr:         s.addr,
		Handler:      s.router,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}
	return srv.ListenAndServe()
}
