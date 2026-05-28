package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/guillaumedelre/reqlet/engine/storage"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newTestStorage(t *testing.T) *storage.Storage {
	t.Helper()
	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", t.Name())
	st, err := storage.New(dsn)
	require.NoError(t, err)
	t.Cleanup(func() { _ = st.Close() })
	return st
}

func testServerWithStorage(t *testing.T) (*server, *storage.Storage) {
	t.Helper()
	s := testServer(t)
	st := newTestStorage(t)
	s.storage = st
	return s, st
}

// ---------- getSettings ----------

func TestGetSettings_NoStorage(t *testing.T) {
	mux := testServer(t).newMux(testFS())
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/settings", nil))
	require.Equal(t, http.StatusOK, w.Code)

	var out settingsData
	require.NoError(t, json.NewDecoder(w.Body).Decode(&out))
	assert.True(t, out.SSLVerification)
	assert.Empty(t, out.ProxyURL)
}

func TestGetSettings_Empty(t *testing.T) {
	s, _ := testServerWithStorage(t)
	mux := s.newMux(testFS())
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/settings", nil))
	require.Equal(t, http.StatusOK, w.Code)

	var out settingsData
	require.NoError(t, json.NewDecoder(w.Body).Decode(&out))
	assert.True(t, out.SSLVerification)
	assert.Empty(t, out.ProxyURL)
}

func TestGetSettings_WithValues(t *testing.T) {
	s, st := testServerWithStorage(t)
	require.NoError(t, st.Settings.Set(t.Context(), settingKeyProxyURL, "http://proxy:3128"))
	require.NoError(t, st.Settings.Set(t.Context(), settingKeySSLVerification, "false"))

	mux := s.newMux(testFS())
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/settings", nil))
	require.Equal(t, http.StatusOK, w.Code)

	var out settingsData
	require.NoError(t, json.NewDecoder(w.Body).Decode(&out))
	assert.Equal(t, "http://proxy:3128", out.ProxyURL)
	assert.False(t, out.SSLVerification)
}

func TestGetSettings_StorageError(t *testing.T) {
	s, st := testServerWithStorage(t)
	require.NoError(t, st.Close())
	mux := s.newMux(testFS())
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/settings", nil))
	assert.Equal(t, http.StatusInternalServerError, w.Code)
}

// ---------- putSettings ----------

func TestPutSettings_NoStorage(t *testing.T) {
	mux := testServer(t).newMux(testFS())
	body, _ := json.Marshal(map[string]any{"proxyUrl": "http://proxy:3128"})
	req := httptest.NewRequest(http.MethodPut, "/api/settings", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)
	require.Equal(t, http.StatusOK, w.Code)

	var out settingsData
	require.NoError(t, json.NewDecoder(w.Body).Decode(&out))
	assert.True(t, out.SSLVerification)
	assert.Empty(t, out.ProxyURL)
}

func TestPutSettings_UpdateAll(t *testing.T) {
	s, _ := testServerWithStorage(t)
	mux := s.newMux(testFS())

	body, _ := json.Marshal(map[string]any{
		"proxyUrl":        "http://proxy:3128",
		"proxyUsername":   "user",
		"proxyPassword":   "pass",
		"noProxy":         "localhost,127.0.0.1",
		"sslVerification": false,
	})
	req := httptest.NewRequest(http.MethodPut, "/api/settings", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)
	require.Equal(t, http.StatusOK, w.Code)

	var out settingsData
	require.NoError(t, json.NewDecoder(w.Body).Decode(&out))
	assert.Equal(t, "http://proxy:3128", out.ProxyURL)
	assert.Equal(t, "user", out.ProxyUsername)
	assert.Equal(t, "pass", out.ProxyPassword)
	assert.Equal(t, "localhost,127.0.0.1", out.NoProxy)
	assert.False(t, out.SSLVerification)
}

func TestPutSettings_UpdatePartial(t *testing.T) {
	s, st := testServerWithStorage(t)
	require.NoError(t, st.Settings.Set(t.Context(), settingKeySSLVerification, "false"))
	mux := s.newMux(testFS())

	body, _ := json.Marshal(map[string]any{"proxyUrl": "http://proxy:3128"})
	req := httptest.NewRequest(http.MethodPut, "/api/settings", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)
	require.Equal(t, http.StatusOK, w.Code)

	var out settingsData
	require.NoError(t, json.NewDecoder(w.Body).Decode(&out))
	assert.Equal(t, "http://proxy:3128", out.ProxyURL)
	assert.False(t, out.SSLVerification, "sslVerification should not be reset by partial update")
}

func TestPutSettings_InvalidJSON(t *testing.T) {
	s, _ := testServerWithStorage(t)
	mux := s.newMux(testFS())
	req := httptest.NewRequest(http.MethodPut, "/api/settings", bytes.NewBufferString("not json"))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestPutSettings_StorageError(t *testing.T) {
	s, st := testServerWithStorage(t)
	require.NoError(t, st.Close())
	mux := s.newMux(testFS())

	body, _ := json.Marshal(map[string]any{"proxyUrl": "http://proxy:3128"})
	req := httptest.NewRequest(http.MethodPut, "/api/settings", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)
	assert.Equal(t, http.StatusInternalServerError, w.Code)
}
