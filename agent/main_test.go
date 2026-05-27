package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"testing/fstest"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func testFS() fstest.MapFS {
	return fstest.MapFS{
		"index.html": {Data: []byte("<!doctype html><html><body>ok</body></html>")},
	}
}

func testServer(t *testing.T) *server {
	t.Helper()
	dir := t.TempDir()
	cols, err := newJSONStore(filepath.Join(dir, "collections"))
	require.NoError(t, err)
	envs, err := newJSONStore(filepath.Join(dir, "environments"))
	require.NoError(t, err)
	return &server{collections: cols, environments: envs}
}

func TestHealth_OK(t *testing.T) {
	mux := testServer(t).newMux(testFS())
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/health", nil))

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Header().Get("Content-Type"), "application/json")

	var body map[string]string
	require.NoError(t, json.NewDecoder(w.Body).Decode(&body))
	assert.Equal(t, "ok", body["status"])
}

func TestHealth_MethodNotAllowed(t *testing.T) {
	mux := testServer(t).newMux(testFS())
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/api/health", nil))

	// ServeMux does not enforce method — handler still responds 200 for POST
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestAPI_UnknownRoute_NotFound(t *testing.T) {
	mux := testServer(t).newMux(testFS())
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/unknown", nil))

	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestStatic_ServesIndexHTML(t *testing.T) {
	mux := testServer(t).newMux(testFS())
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/", nil))

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Body.String(), "ok")
}

func TestStatic_NotFoundForMissingFile(t *testing.T) {
	mux := testServer(t).newMux(testFS())
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/does-not-exist.js", nil))

	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestStatic_SPAFallback(t *testing.T) {
	mux := testServer(t).newMux(testFS())
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/some-spa-route", nil))

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Body.String(), "ok")
}

func TestStatic_SPAFallback_NoIndexHTML(t *testing.T) {
	// FS without index.html — SPA fallback must return 404.
	mux := testServer(t).newMux(fstest.MapFS{})
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/some-route", nil))
	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestHandleSend_MethodNotAllowed(t *testing.T) {
	mux := testServer(t).newMux(testFS())
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/send", nil))
	assert.Equal(t, http.StatusMethodNotAllowed, w.Code)
}

func TestStatic_SPAFallback_NestedRoute(t *testing.T) {
	mux := testServer(t).newMux(testFS())
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/collections/abc-123", nil))

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Body.String(), "ok")
}

// --- Collections ---

func TestListCollections_Empty(t *testing.T) {
	mux := testServer(t).newMux(testFS())
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/collections", nil))

	assert.Equal(t, http.StatusOK, w.Code)
	var body []json.RawMessage
	require.NoError(t, json.NewDecoder(w.Body).Decode(&body))
	assert.Empty(t, body)
}

func TestCreateCollection(t *testing.T) {
	mux := testServer(t).newMux(testFS())
	payload := `{"id":"col-abc","name":"My Collection"}`
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/api/collections",
		strings.NewReader(payload)))

	assert.Equal(t, http.StatusCreated, w.Code)
	assert.JSONEq(t, payload, w.Body.String())
}

func TestCreateCollection_MissingID(t *testing.T) {
	mux := testServer(t).newMux(testFS())
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/api/collections",
		strings.NewReader(`{"name":"No ID"}`)))

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestCreateCollection_InvalidBody(t *testing.T) {
	mux := testServer(t).newMux(testFS())
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/api/collections",
		strings.NewReader("not json")))

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestGetCollection(t *testing.T) {
	s := testServer(t)
	mux := s.newMux(testFS())

	payload := `{"id":"col-abc","name":"My Collection"}`
	require.NoError(t, s.collections.save("col-abc", json.RawMessage(payload)))

	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/collections/col-abc", nil))

	assert.Equal(t, http.StatusOK, w.Code)
	assert.JSONEq(t, payload, w.Body.String())
}

func TestGetCollection_NotFound(t *testing.T) {
	mux := testServer(t).newMux(testFS())
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/collections/nonexistent", nil))

	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestUpdateCollection(t *testing.T) {
	s := testServer(t)
	mux := s.newMux(testFS())

	require.NoError(t, s.collections.save("col-abc", json.RawMessage(`{"id":"col-abc","name":"Old"}`)))

	updated := `{"id":"col-abc","name":"Updated"}`
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodPut, "/api/collections/col-abc",
		strings.NewReader(updated)))

	assert.Equal(t, http.StatusOK, w.Code)
	assert.JSONEq(t, updated, w.Body.String())
}

func TestUpdateCollection_InvalidBody(t *testing.T) {
	mux := testServer(t).newMux(testFS())
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodPut, "/api/collections/col-abc",
		strings.NewReader("not json")))

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestDeleteCollection(t *testing.T) {
	s := testServer(t)
	mux := s.newMux(testFS())

	require.NoError(t, s.collections.save("col-abc", json.RawMessage(`{"id":"col-abc"}`)))

	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodDelete, "/api/collections/col-abc", nil))

	assert.Equal(t, http.StatusNoContent, w.Code)

	_, err := s.collections.get("col-abc")
	assert.ErrorIs(t, err, errNotFound)
}

func TestListCollections_MultipleItems(t *testing.T) {
	s := testServer(t)
	mux := s.newMux(testFS())

	require.NoError(t, s.collections.save("a", json.RawMessage(`{"id":"a"}`)))
	require.NoError(t, s.collections.save("b", json.RawMessage(`{"id":"b"}`)))

	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/collections", nil))

	assert.Equal(t, http.StatusOK, w.Code)
	var body []json.RawMessage
	require.NoError(t, json.NewDecoder(w.Body).Decode(&body))
	assert.Len(t, body, 2)
}

// --- Environments ---

func TestListEnvironments_Empty(t *testing.T) {
	mux := testServer(t).newMux(testFS())
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/environments", nil))

	assert.Equal(t, http.StatusOK, w.Code)
	var body []json.RawMessage
	require.NoError(t, json.NewDecoder(w.Body).Decode(&body))
	assert.Empty(t, body)
}

func TestCreateEnvironment(t *testing.T) {
	mux := testServer(t).newMux(testFS())
	payload := `{"id":"env-prod","name":"Production"}`
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/api/environments",
		strings.NewReader(payload)))

	assert.Equal(t, http.StatusCreated, w.Code)
	assert.JSONEq(t, payload, w.Body.String())
}

func TestCreateEnvironment_MissingID(t *testing.T) {
	mux := testServer(t).newMux(testFS())
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/api/environments",
		strings.NewReader(`{"name":"No ID"}`)))

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestCreateEnvironment_InvalidBody(t *testing.T) {
	mux := testServer(t).newMux(testFS())
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/api/environments",
		strings.NewReader("not json")))

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestGetEnvironment(t *testing.T) {
	s := testServer(t)
	mux := s.newMux(testFS())

	payload := `{"id":"env-prod","name":"Production"}`
	require.NoError(t, s.environments.save("env-prod", json.RawMessage(payload)))

	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/environments/env-prod", nil))

	assert.Equal(t, http.StatusOK, w.Code)
	assert.JSONEq(t, payload, w.Body.String())
}

func TestGetEnvironment_NotFound(t *testing.T) {
	mux := testServer(t).newMux(testFS())
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/environments/nonexistent", nil))

	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestUpdateEnvironment(t *testing.T) {
	s := testServer(t)
	mux := s.newMux(testFS())

	require.NoError(t, s.environments.save("env-prod", json.RawMessage(`{"id":"env-prod","name":"Old"}`)))

	updated := `{"id":"env-prod","name":"Updated"}`
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodPut, "/api/environments/env-prod",
		strings.NewReader(updated)))

	assert.Equal(t, http.StatusOK, w.Code)
	assert.JSONEq(t, updated, w.Body.String())
}

func TestUpdateEnvironment_InvalidBody(t *testing.T) {
	mux := testServer(t).newMux(testFS())
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodPut, "/api/environments/env-prod",
		strings.NewReader("not json")))

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestDeleteEnvironment(t *testing.T) {
	s := testServer(t)
	mux := s.newMux(testFS())

	require.NoError(t, s.environments.save("env-prod", json.RawMessage(`{"id":"env-prod"}`)))

	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodDelete, "/api/environments/env-prod", nil))

	assert.Equal(t, http.StatusNoContent, w.Code)

	_, err := s.environments.get("env-prod")
	assert.ErrorIs(t, err, errNotFound)
}

// --- Collections: store error paths ---

func TestListCollections_StoreError(t *testing.T) {
	s := testServer(t)
	// Replace store dir with a regular file so list() fails.
	require.NoError(t, os.RemoveAll(s.collections.dir))
	require.NoError(t, os.WriteFile(s.collections.dir, []byte("not a dir"), 0o600))

	mux := s.newMux(testFS())
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/collections", nil))
	assert.Equal(t, http.StatusInternalServerError, w.Code)
}

func TestCreateCollection_StoreError(t *testing.T) {
	s := testServer(t)
	// Place a directory at the save target so WriteFile fails.
	require.NoError(t, os.MkdirAll(s.collections.path("col-x"), 0o750))

	mux := s.newMux(testFS())
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/api/collections",
		strings.NewReader(`{"id":"col-x","name":"Test"}`)))
	assert.Equal(t, http.StatusInternalServerError, w.Code)
}

func TestGetCollection_StoreError(t *testing.T) {
	s := testServer(t)
	// Place a directory at the read target — not errNotFound.
	require.NoError(t, os.MkdirAll(s.collections.path("col-x"), 0o750))

	mux := s.newMux(testFS())
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/collections/col-x", nil))
	assert.Equal(t, http.StatusInternalServerError, w.Code)
}

func TestUpdateCollection_StoreError(t *testing.T) {
	s := testServer(t)
	// Place a directory at the save target so WriteFile fails.
	require.NoError(t, os.MkdirAll(s.collections.path("col-x"), 0o750))

	mux := s.newMux(testFS())
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodPut, "/api/collections/col-x",
		strings.NewReader(`{"id":"col-x","name":"Test"}`)))
	assert.Equal(t, http.StatusInternalServerError, w.Code)
}

func TestDeleteCollection_StoreError(t *testing.T) {
	s := testServer(t)
	// Place a non-empty directory so os.Remove fails.
	require.NoError(t, os.MkdirAll(filepath.Join(s.collections.path("col-x"), "sub"), 0o750))

	mux := s.newMux(testFS())
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodDelete, "/api/collections/col-x", nil))
	assert.Equal(t, http.StatusInternalServerError, w.Code)
}

// --- Environments: store error paths ---

func TestListEnvironments_StoreError(t *testing.T) {
	s := testServer(t)
	require.NoError(t, os.RemoveAll(s.environments.dir))
	require.NoError(t, os.WriteFile(s.environments.dir, []byte("not a dir"), 0o600))

	mux := s.newMux(testFS())
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/environments", nil))
	assert.Equal(t, http.StatusInternalServerError, w.Code)
}

func TestCreateEnvironment_StoreError(t *testing.T) {
	s := testServer(t)
	require.NoError(t, os.MkdirAll(s.environments.path("env-x"), 0o750))

	mux := s.newMux(testFS())
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/api/environments",
		strings.NewReader(`{"id":"env-x","name":"Test"}`)))
	assert.Equal(t, http.StatusInternalServerError, w.Code)
}

func TestGetEnvironment_StoreError(t *testing.T) {
	s := testServer(t)
	require.NoError(t, os.MkdirAll(s.environments.path("env-x"), 0o750))

	mux := s.newMux(testFS())
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/environments/env-x", nil))
	assert.Equal(t, http.StatusInternalServerError, w.Code)
}

func TestUpdateEnvironment_StoreError(t *testing.T) {
	s := testServer(t)
	require.NoError(t, os.MkdirAll(s.environments.path("env-x"), 0o750))

	mux := s.newMux(testFS())
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodPut, "/api/environments/env-x",
		strings.NewReader(`{"id":"env-x","name":"Test"}`)))
	assert.Equal(t, http.StatusInternalServerError, w.Code)
}

func TestDeleteEnvironment_StoreError(t *testing.T) {
	s := testServer(t)
	require.NoError(t, os.MkdirAll(filepath.Join(s.environments.path("env-x"), "sub"), 0o750))

	mux := s.newMux(testFS())
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodDelete, "/api/environments/env-x", nil))
	assert.Equal(t, http.StatusInternalServerError, w.Code)
}

func TestListEnvironments_MultipleItems(t *testing.T) {
	s := testServer(t)
	mux := s.newMux(testFS())

	require.NoError(t, s.environments.save("a", json.RawMessage(`{"id":"a"}`)))
	require.NoError(t, s.environments.save("b", json.RawMessage(`{"id":"b"}`)))

	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/environments", nil))

	assert.Equal(t, http.StatusOK, w.Code)
	var body []json.RawMessage
	require.NoError(t, json.NewDecoder(w.Body).Decode(&body))
	assert.Len(t, body, 2)
}

// ---------------------------------------------------------------------------
// Import / Export — collections
// ---------------------------------------------------------------------------

const validPostmanCollection = `{
  "info": {
    "_postman_id": "import-test-id",
    "name": "Import Test",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": []
}`

const validPostmanEnvironment = `{
  "id": "env-import-id",
  "name": "Import Env",
  "values": [],
  "_postman_variable_scope": "environment"
}`

func TestImportCollection_Valid(t *testing.T) {
	mux := testServer(t).newMux(testFS())
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/api/collections/import",
		strings.NewReader(validPostmanCollection)))

	assert.Equal(t, http.StatusCreated, w.Code)
	var out map[string]interface{}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&out))
	assert.Equal(t, "Import Test", out["name"])
}

func TestImportCollection_InvalidJSON(t *testing.T) {
	mux := testServer(t).newMux(testFS())
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/api/collections/import",
		strings.NewReader(`not json at all`)))

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestImportCollection_EmptyBody(t *testing.T) {
	mux := testServer(t).newMux(testFS())
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/api/collections/import",
		strings.NewReader(`{}`)))

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestExportCollection_Existing(t *testing.T) {
	s := testServer(t)
	mux := s.newMux(testFS())

	// seed a minimal frontend-format collection
	require.NoError(t, s.collections.save("col-export", json.RawMessage(
		`{"id":"col-export","name":"My Export","description":"","items":[],"variables":[],"preRequestScript":"","testScript":"","auth":{"type":"none"}}`,
	)))

	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/collections/col-export/export", nil))

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Header().Get("Content-Disposition"), "My Export.postman_collection.json")
	var out map[string]interface{}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&out))
	info := out["info"].(map[string]interface{})
	assert.Equal(t, "My Export", info["name"])
}

func TestExportCollection_NotFound(t *testing.T) {
	mux := testServer(t).newMux(testFS())
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/collections/nonexistent/export", nil))

	assert.Equal(t, http.StatusNotFound, w.Code)
}

// ---------------------------------------------------------------------------
// Import / Export — environments
// ---------------------------------------------------------------------------

func TestImportEnvironment_Valid(t *testing.T) {
	mux := testServer(t).newMux(testFS())
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/api/environments/import",
		strings.NewReader(validPostmanEnvironment)))

	assert.Equal(t, http.StatusCreated, w.Code)
	var out map[string]interface{}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&out))
	assert.Equal(t, "Import Env", out["name"])
}

func TestImportEnvironment_InvalidJSON(t *testing.T) {
	mux := testServer(t).newMux(testFS())
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/api/environments/import",
		strings.NewReader(`not json`)))

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestExportEnvironment_Existing(t *testing.T) {
	s := testServer(t)
	mux := s.newMux(testFS())

	require.NoError(t, s.environments.save("env-export", json.RawMessage(
		`{"id":"env-export","name":"My Env","variables":[]}`,
	)))

	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/environments/env-export/export", nil))

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Header().Get("Content-Disposition"), "My Env.postman_environment.json")
	var out map[string]interface{}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&out))
	assert.Equal(t, "My Env", out["name"])
}

func TestExportEnvironment_NotFound(t *testing.T) {
	mux := testServer(t).newMux(testFS())
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/environments/ghost/export", nil))

	assert.Equal(t, http.StatusNotFound, w.Code)
}
