package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/guillaumedelre/reqlet/engine/storage"
)

// mockSettingsStore is a SettingsStore that succeeds on Set but fails on List.
type mockSettingsStore struct {
	data    map[string]string
	listErr error
}

func (m *mockSettingsStore) Get(_ context.Context, key string) (string, error) {
	return m.data[key], nil
}

func (m *mockSettingsStore) Set(_ context.Context, key, value string) error {
	if m.data == nil {
		m.data = make(map[string]string)
	}
	m.data[key] = value
	return nil
}

func (m *mockSettingsStore) List(_ context.Context) (map[string]string, error) {
	if m.listErr != nil {
		return nil, m.listErr
	}
	out := make(map[string]string, len(m.data))
	for k, v := range m.data {
		out[k] = v
	}
	return out, nil
}

// testServerWithMockSettings returns a server whose Settings store uses a mock.
func testServerWithMockSettings(t *testing.T, mock storage.SettingsStore) *server {
	t.Helper()
	s := testServer(t)
	// We need a non-nil *storage.Storage with our mock SettingsStore.
	// Use the real Storage but swap out Settings via a thin wrapper.
	st := newTestStorage(t)
	st.Settings = mock
	s.storage = st
	return s
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

// ---------- new fields ----------

func TestGetSettings_Defaults(t *testing.T) {
	mux := testServer(t).newMux(testFS())
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/settings", nil))
	require.Equal(t, http.StatusOK, w.Code)

	var out settingsData
	require.NoError(t, json.NewDecoder(w.Body).Decode(&out))
	assert.Equal(t, 50, out.MaxResponseSizeMB)
	assert.Equal(t, 5000, out.ScriptTimeoutMs)
	assert.False(t, out.UseSystemProxy)
	assert.False(t, out.RespectEnvProxy)
}

func TestPutSettings_NewFields(t *testing.T) {
	s, _ := testServerWithStorage(t)
	mux := s.newMux(testFS())

	useSystem := true
	respectEnv := true
	maxMB := 100
	scriptMs := 3000
	body, _ := json.Marshal(settingsInput{
		UseSystemProxy:    &useSystem,
		RespectEnvProxy:   &respectEnv,
		MaxResponseSizeMB: &maxMB,
		ScriptTimeoutMs:   &scriptMs,
	})
	req := httptest.NewRequest(http.MethodPut, "/api/settings", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)
	require.Equal(t, http.StatusOK, w.Code)

	var out settingsData
	require.NoError(t, json.NewDecoder(w.Body).Decode(&out))
	assert.True(t, out.UseSystemProxy)
	assert.True(t, out.RespectEnvProxy)
	assert.Equal(t, 100, out.MaxResponseSizeMB)
	assert.Equal(t, 3000, out.ScriptTimeoutMs)
}

func TestBuildSettings_NewFields_Roundtrip(t *testing.T) {
	m := map[string]string{
		settingKeyUseSystemProxy:    "true",
		settingKeyRespectEnvProxy:   "true",
		settingKeyMaxResponseSizeMB: "75",
		settingKeyScriptTimeoutMs:   "2500",
	}
	d := buildSettings(m)
	assert.True(t, d.UseSystemProxy)
	assert.True(t, d.RespectEnvProxy)
	assert.Equal(t, 75, d.MaxResponseSizeMB)
	assert.Equal(t, 2500, d.ScriptTimeoutMs)
}

func TestBuildSettings_InvalidInt_FallsBackToDefault(t *testing.T) {
	m := map[string]string{
		settingKeyMaxResponseSizeMB: "not-a-number",
		settingKeyScriptTimeoutMs:   "also-bad",
	}
	d := buildSettings(m)
	assert.Equal(t, 50, d.MaxResponseSizeMB)
	assert.Equal(t, 5000, d.ScriptTimeoutMs)
}

// TestPutSettings_ExistingFieldsOnly_NewFieldsUntouched verifies that when a
// PUT body contains only string fields (ProxyURL) and leaves the pointer fields
// (UseSystemProxy, RespectEnvProxy, MaxResponseSizeMB, ScriptTimeoutMs) absent,
// the nil-pointer branches inside setBool/setInt are not taken and previously
// stored values remain unchanged.
// TestPutSettings_ListErrorAfterSet covers the Settings.List error branch (line 109)
// that is unreachable via a real SQLite storage (where closing the DB also breaks Set).
// We use a mock where Set succeeds but List always returns an error.
func TestPutSettings_ListErrorAfterSet(t *testing.T) {
	mock := &mockSettingsStore{listErr: errors.New("list failed")}
	s := testServerWithMockSettings(t, mock)
	mux := s.newMux(testFS())

	body, _ := json.Marshal(map[string]any{"proxyUrl": "http://proxy:3128"})
	req := httptest.NewRequest(http.MethodPut, "/api/settings", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)
	assert.Equal(t, http.StatusInternalServerError, w.Code)
}

func TestPutSettings_ExistingFieldsOnly_NewFieldsUntouched(t *testing.T) {
	s, st := testServerWithStorage(t)
	// Pre-populate a value that must survive the partial update.
	require.NoError(t, st.Settings.Set(t.Context(), settingKeyMaxResponseSizeMB, "42"))
	mux := s.newMux(testFS())

	// Send only proxyUrl — pointer fields are nil, so setBool/setInt skip them.
	body, _ := json.Marshal(map[string]any{"proxyUrl": "http://p:3128"})
	req := httptest.NewRequest(http.MethodPut, "/api/settings", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)
	require.Equal(t, http.StatusOK, w.Code)

	var out settingsData
	require.NoError(t, json.NewDecoder(w.Body).Decode(&out))
	assert.Equal(t, "http://p:3128", out.ProxyURL)
	// MaxResponseSizeMB must still be 42, not overwritten by a nil pointer.
	assert.Equal(t, 42, out.MaxResponseSizeMB)
}
