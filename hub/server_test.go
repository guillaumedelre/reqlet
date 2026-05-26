package main

import (
	"encoding/json"
	"net"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newTestServer() *Server {
	return NewServer(":0")
}

func TestHealth_OK(t *testing.T) {
	s := newTestServer()
	w := httptest.NewRecorder()
	s.router.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/health", nil))

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Header().Get("Content-Type"), "application/json")

	var body map[string]string
	require.NoError(t, json.NewDecoder(w.Body).Decode(&body))
	assert.Equal(t, "ok", body["status"])
}

func TestHealth_MethodNotAllowed(t *testing.T) {
	s := newTestServer()
	w := httptest.NewRecorder()
	s.router.ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/api/health", nil))

	assert.Equal(t, http.StatusMethodNotAllowed, w.Code)
}

func TestAPI_UnknownRoute_NotFound(t *testing.T) {
	s := newTestServer()
	w := httptest.NewRecorder()
	s.router.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/unknown", nil))

	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestStart_ErrorOnAlreadyBoundAddr(t *testing.T) {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	defer func() { _ = ln.Close() }()

	s := NewServer(ln.Addr().String())
	err = s.Start()
	require.Error(t, err)
}
