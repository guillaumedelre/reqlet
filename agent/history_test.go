package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/guillaumedelre/reqlet/engine/storage"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ---------- listHistory ----------

func TestListHistory_NoStorage(t *testing.T) {
	mux := testServer(t).newMux(testFS())
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/history", nil))
	assert.Equal(t, http.StatusOK, w.Code)
	var out []historySummary
	require.NoError(t, json.NewDecoder(w.Body).Decode(&out))
	assert.Empty(t, out)
}

func TestListHistory_Empty(t *testing.T) {
	s, _ := testServerWithStorage(t)
	mux := s.newMux(testFS())
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/history", nil))
	assert.Equal(t, http.StatusOK, w.Code)
	var out []historySummary
	require.NoError(t, json.NewDecoder(w.Body).Decode(&out))
	assert.Empty(t, out)
}

func TestListHistory_WithEntries(t *testing.T) {
	s, st := testServerWithStorage(t)
	mux := s.newMux(testFS())

	reqJSON, _ := json.Marshal(map[string]string{"method": "GET", "url": "http://example.com"})
	respJSON, _ := json.Marshal(map[string]int{"status": 200})
	require.NoError(t, st.History.Insert(t.Context(), storage.HistoryEntry{
		ID: "h1", Timestamp: time.Now(), Request: reqJSON, Response: respJSON, DurationMs: 42,
	}))

	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/history", nil))
	require.Equal(t, http.StatusOK, w.Code)

	var out []historySummary
	require.NoError(t, json.NewDecoder(w.Body).Decode(&out))
	require.Len(t, out, 1)
	assert.Equal(t, "h1", out[0].ID)
	assert.Equal(t, "GET", out[0].Method)
	assert.Equal(t, "http://example.com", out[0].URL)
	assert.Equal(t, 200, out[0].Status)
	assert.Equal(t, int64(42), out[0].DurationMs)
}

func TestListHistory_Pagination(t *testing.T) {
	s, st := testServerWithStorage(t)
	mux := s.newMux(testFS())

	for i := range 5 {
		reqJSON, _ := json.Marshal(map[string]string{"method": "GET", "url": fmt.Sprintf("http://example.com/%d", i)})
		respJSON, _ := json.Marshal(map[string]int{"status": 200})
		require.NoError(t, st.History.Insert(t.Context(), storage.HistoryEntry{
			ID: fmt.Sprintf("h%d", i), Timestamp: time.Now(), Request: reqJSON, Response: respJSON,
		}))
	}

	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/history?limit=2&offset=1", nil))
	require.Equal(t, http.StatusOK, w.Code)

	var out []historySummary
	require.NoError(t, json.NewDecoder(w.Body).Decode(&out))
	assert.Len(t, out, 2)
}

// ---------- deleteHistoryEntry ----------

func TestDeleteHistoryEntry_NoStorage(t *testing.T) {
	mux := testServer(t).newMux(testFS())
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodDelete, "/api/history/any-id", nil))
	assert.Equal(t, http.StatusNoContent, w.Code)
}

func TestDeleteHistoryEntry_Success(t *testing.T) {
	s, st := testServerWithStorage(t)
	mux := s.newMux(testFS())

	reqJSON, _ := json.Marshal(map[string]string{"method": "DELETE", "url": "http://example.com"})
	respJSON, _ := json.Marshal(map[string]int{"status": 204})
	require.NoError(t, st.History.Insert(t.Context(), storage.HistoryEntry{
		ID: "del-1", Timestamp: time.Now(), Request: reqJSON, Response: respJSON,
	}))

	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodDelete, "/api/history/del-1", nil))
	assert.Equal(t, http.StatusNoContent, w.Code)

	entries, err := st.History.List(t.Context(), 10, 0)
	require.NoError(t, err)
	assert.Empty(t, entries)
}

// ---------- clearHistory ----------

func TestClearHistory_NoStorage(t *testing.T) {
	mux := testServer(t).newMux(testFS())
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodDelete, "/api/history", nil))
	assert.Equal(t, http.StatusNoContent, w.Code)
}

func TestClearHistory_Success(t *testing.T) {
	s, st := testServerWithStorage(t)
	mux := s.newMux(testFS())

	reqJSON, _ := json.Marshal(map[string]string{"method": "GET", "url": "http://x.com"})
	respJSON, _ := json.Marshal(map[string]int{"status": 200})
	for _, id := range []string{"c1", "c2"} {
		require.NoError(t, st.History.Insert(t.Context(), storage.HistoryEntry{
			ID: id, Timestamp: time.Now(), Request: reqJSON, Response: respJSON,
		}))
	}

	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodDelete, "/api/history", nil))
	assert.Equal(t, http.StatusNoContent, w.Code)

	entries, err := st.History.List(t.Context(), 10, 0)
	require.NoError(t, err)
	assert.Empty(t, entries)
}

func TestListHistory_StorageError(t *testing.T) {
	s, st := testServerWithStorage(t)
	require.NoError(t, st.Close()) // force closed DB error
	mux := s.newMux(testFS())
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/history", nil))
	assert.Equal(t, http.StatusInternalServerError, w.Code)
}

func TestDeleteHistoryEntry_StorageError(t *testing.T) {
	s, st := testServerWithStorage(t)
	require.NoError(t, st.Close())
	mux := s.newMux(testFS())
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodDelete, "/api/history/any", nil))
	assert.Equal(t, http.StatusInternalServerError, w.Code)
}

func TestClearHistory_StorageError(t *testing.T) {
	s, st := testServerWithStorage(t)
	require.NoError(t, st.Close())
	mux := s.newMux(testFS())
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodDelete, "/api/history", nil))
	assert.Equal(t, http.StatusInternalServerError, w.Code)
}

// ---------- auto-save in handleSend ----------

func TestHandleSend_SavesHistory(t *testing.T) {
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer target.Close()

	s, st := testServerWithStorage(t)
	mux := s.newMux(testFS())

	body, _ := json.Marshal(sendReq{
		Method: "GET", URL: target.URL,
		FollowRedirects: true, SslVerification: true,
	})
	postReq := httptest.NewRequest(http.MethodPost, "/api/send", bytes.NewReader(body))
	postReq.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, postReq)
	require.Equal(t, http.StatusOK, w.Code)

	entries, err := st.History.List(t.Context(), 10, 0)
	require.NoError(t, err)
	require.Len(t, entries, 1)
	assert.GreaterOrEqual(t, entries[0].DurationMs, int64(0))

	var savedResp struct{ Status int }
	require.NoError(t, json.Unmarshal(entries[0].Response, &savedResp))
	assert.Equal(t, http.StatusOK, savedResp.Status)
}
