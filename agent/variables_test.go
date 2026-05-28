package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func mustStoreVariables(t *testing.T, store *jsonStore, id string, vars []feVariable) {
	t.Helper()
	raw, _ := json.Marshal(map[string]any{"id": id, "name": id, "variables": vars})
	require.NoError(t, store.save(id, raw))
}

// ---------- getVariables ----------

func TestGetVariables_NoParams(t *testing.T) {
	mux := testServer(t).newMux(testFS())
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/variables", nil))
	require.Equal(t, http.StatusOK, w.Code)

	var out variablesResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&out))
	assert.Empty(t, out.Globals)
	assert.Empty(t, out.Environment)
	assert.Empty(t, out.Collection)
}

func TestGetVariables_EnvironmentOnly(t *testing.T) {
	s := testServer(t)
	mux := s.newMux(testFS())

	vars := []feVariable{
		{ID: "v1", Key: "baseUrl", InitialValue: "http://api.example.com", CurrentValue: "http://api.example.com", Enabled: true},
		{ID: "v2", Key: "token", InitialValue: "secret", CurrentValue: "secret", Enabled: true},
	}
	mustStoreVariables(t, s.environments, "env-1", vars)

	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/variables?environmentId=env-1", nil))
	require.Equal(t, http.StatusOK, w.Code)

	var out variablesResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&out))
	assert.Empty(t, out.Globals)
	assert.Empty(t, out.Collection)
	require.Len(t, out.Environment, 2)
	assert.Equal(t, "baseUrl", out.Environment[0].Key)
	assert.Equal(t, "http://api.example.com", out.Environment[0].CurrentValue)
}

func TestGetVariables_CollectionOnly(t *testing.T) {
	s := testServer(t)
	mux := s.newMux(testFS())

	vars := []feVariable{
		{ID: "c1", Key: "version", InitialValue: "v1", CurrentValue: "v1", Enabled: true},
	}
	mustStoreVariables(t, s.collections, "col-1", vars)

	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/variables?collectionId=col-1", nil))
	require.Equal(t, http.StatusOK, w.Code)

	var out variablesResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&out))
	assert.Empty(t, out.Globals)
	assert.Empty(t, out.Environment)
	require.Len(t, out.Collection, 1)
	assert.Equal(t, "version", out.Collection[0].Key)
	assert.Equal(t, "v1", out.Collection[0].CurrentValue)
}

func TestGetVariables_BothScopes(t *testing.T) {
	s := testServer(t)
	mux := s.newMux(testFS())

	mustStoreVariables(t, s.environments, "env-2", []feVariable{
		{ID: "e1", Key: "host", InitialValue: "localhost", CurrentValue: "localhost", Enabled: true},
	})
	mustStoreVariables(t, s.collections, "col-2", []feVariable{
		{ID: "c1", Key: "apiVersion", InitialValue: "2", CurrentValue: "2", Enabled: true},
		{ID: "c2", Key: "timeout", InitialValue: "30", CurrentValue: "30", Enabled: false},
	})

	const url = "/api/variables?collectionId=col-2&environmentId=env-2"
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodGet, url, nil))
	require.Equal(t, http.StatusOK, w.Code)

	var out variablesResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&out))
	assert.Empty(t, out.Globals)
	require.Len(t, out.Environment, 1)
	assert.Equal(t, "host", out.Environment[0].Key)
	require.Len(t, out.Collection, 2)
	assert.Equal(t, "apiVersion", out.Collection[0].Key)
	assert.False(t, out.Collection[1].Enabled)
}

func TestGetVariables_UnknownIDs(t *testing.T) {
	mux := testServer(t).newMux(testFS())
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/variables?collectionId=nope&environmentId=nope", nil))
	require.Equal(t, http.StatusOK, w.Code)

	var out variablesResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&out))
	assert.Empty(t, out.Globals)
	assert.Empty(t, out.Environment)
	assert.Empty(t, out.Collection)
}
