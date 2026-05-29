package main

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/guillaumedelre/reqlet/engine/parser"
	"github.com/guillaumedelre/reqlet/engine/runner"
	"github.com/guillaumedelre/reqlet/engine/sandbox"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// makeTestCollection returns a frontend-format collection JSON with the given request names.
func makeTestCollection(id, name string, requests []string) []byte {
	items := make([]map[string]any, len(requests))
	for i, rname := range requests {
		items[i] = map[string]any{
			"id":      fmt.Sprintf("req-%d", i),
			"name":    rname,
			"method":  "GET",
			"url":     "https://example.com/" + rname,
			"params":  []any{},
			"headers": []any{},
			"auth":    map[string]any{"type": "none"},
		}
	}
	col := map[string]any{
		"id":               id,
		"name":             name,
		"description":      "",
		"items":            items,
		"variables":        []any{},
		"preRequestScript": "",
		"testScript":       "",
		"auth":             map[string]any{"type": "none"},
	}
	data, _ := json.Marshal(col)
	return data
}

// saveCollection stores a frontend collection in the server's jsonStore and returns its ID.
func saveCollection(t *testing.T, s *server, colJSON []byte) string {
	t.Helper()
	var raw json.RawMessage = colJSON
	id, err := extractStringField(raw, "id")
	require.NoError(t, err)
	require.NoError(t, s.collections.save(id, raw))
	return id
}

// readSSEEvents reads all "data: ..." lines from an SSE response body until EOF.
func readSSEEvents(t *testing.T, body string) []runEvent {
	t.Helper()
	var events []runEvent
	sc := bufio.NewScanner(strings.NewReader(body))
	for sc.Scan() {
		line := sc.Text()
		if !strings.HasPrefix(line, "data: ") {
			continue
		}
		payload := strings.TrimPrefix(line, "data: ")
		var evt runEvent
		require.NoError(t, json.Unmarshal([]byte(payload), &evt))
		events = append(events, evt)
	}
	return events
}

// ---- POST /api/collections/{id}/run ----

func TestHandleRunCollection_NotFound(t *testing.T) {
	s := testServer(t)
	mux := s.newMux(testFS())

	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/api/collections/missing/run", nil))

	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestHandleRunCollection_EmptyBody_DefaultsToOneIteration(t *testing.T) {
	s := testServer(t)
	colJSON := makeTestCollection("col-1", "TestCol", []string{"req1"})
	colID := saveCollection(t, s, colJSON)
	mux := s.newMux(testFS())

	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/api/collections/"+colID+"/run", nil))

	require.Equal(t, http.StatusAccepted, w.Code)
	var resp map[string]string
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.NotEmpty(t, resp["runId"])
}

func TestHandleRunCollection_ReturnsRunID(t *testing.T) {
	s := testServer(t)
	colJSON := makeTestCollection("col-2", "TestCol", []string{"req1", "req2"})
	colID := saveCollection(t, s, colJSON)
	mux := s.newMux(testFS())

	body := `{"iterations":1,"delayMs":0,"bail":false}`
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/api/collections/"+colID+"/run",
		strings.NewReader(body)))

	require.Equal(t, http.StatusAccepted, w.Code)
	var resp map[string]string
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.NotEmpty(t, resp["runId"], "runId should be present in response")
}

func TestHandleRunCollection_StoresRunEntry(t *testing.T) {
	s := testServer(t)
	colJSON := makeTestCollection("col-3", "TestCol", []string{"req1"})
	colID := saveCollection(t, s, colJSON)
	mux := s.newMux(testFS())

	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/api/collections/"+colID+"/run", nil))
	require.Equal(t, http.StatusAccepted, w.Code)

	var resp map[string]string
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	runID := resp["runId"]

	_, ok := s.runs.Load(runID)
	assert.True(t, ok, "run entry should be stored in server.runs")
}

func TestHandleRunCollection_InvalidCollection(t *testing.T) {
	s := testServer(t)
	require.NoError(t, s.collections.save("bad-col", json.RawMessage("not valid json")))
	mux := s.newMux(testFS())

	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/api/collections/bad-col/run", nil))

	assert.Equal(t, http.StatusInternalServerError, w.Code)
}

// ---- GET /api/runs/{runId} ----

func TestHandleGetRun_NotFound(t *testing.T) {
	s := testServer(t)
	mux := s.newMux(testFS())

	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/runs/nope", nil))

	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestHandleGetRun_RunningReturns202(t *testing.T) {
	s := testServer(t)
	entry := &runEntry{ch: make(chan runEvent, 10)}
	s.runs.Store("run-42", entry)
	mux := s.newMux(testFS())

	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/runs/run-42", nil))

	assert.Equal(t, http.StatusAccepted, w.Code)
	var body map[string]string
	require.NoError(t, json.NewDecoder(w.Body).Decode(&body))
	assert.Equal(t, "running", body["status"])
}

func TestHandleGetRun_DoneReturnsSummary(t *testing.T) {
	s := testServer(t)
	summary := &runSummary{
		RunID:        "run-99",
		CollectionID: "col-1",
		StartedAt:    time.Now().UTC().Format(time.RFC3339),
		DurationMs:   123,
		Total:        2,
		Passed:       2,
		Failed:       0,
	}
	entry := &runEntry{
		ch:      make(chan runEvent, 10),
		done:    true,
		summary: summary,
	}
	s.runs.Store("run-99", entry)
	mux := s.newMux(testFS())

	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/runs/run-99", nil))

	require.Equal(t, http.StatusOK, w.Code)
	var got runSummary
	require.NoError(t, json.NewDecoder(w.Body).Decode(&got))
	assert.Equal(t, "run-99", got.RunID)
	assert.Equal(t, 2, got.Total)
	assert.Equal(t, 2, got.Passed)
	assert.Equal(t, 0, got.Failed)
}

func TestHandleGetRun_DoneNoSummaryReturns202(t *testing.T) {
	s := testServer(t)
	entry := &runEntry{
		ch:   make(chan runEvent, 10),
		done: true,
		// summary intentionally nil
	}
	s.runs.Store("run-nosummary", entry)
	mux := s.newMux(testFS())

	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/runs/run-nosummary", nil))

	assert.Equal(t, http.StatusAccepted, w.Code)
}

// ---- GET /api/runs/{runId}/stream ----

func TestHandleRunStream_NotFound(t *testing.T) {
	s := testServer(t)
	mux := s.newMux(testFS())

	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/runs/nope/stream", nil))

	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestHandleRunStream_DoneReplaysAllEvents(t *testing.T) {
	s := testServer(t)
	summary := &runSummary{RunID: "r1", CollectionID: "c1", Total: 1, Passed: 1}
	entry := &runEntry{
		ch:      make(chan runEvent, 10),
		done:    true,
		summary: summary,
		events: []runEvent{
			{Type: "start", Total: 1, Iterations: 1},
			{Type: "request", Name: "req1", Passed: true},
			{Type: "done", Summary: summary},
		},
	}
	s.runs.Store("r1", entry)
	mux := s.newMux(testFS())

	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/runs/r1/stream", nil))

	assert.Contains(t, w.Header().Get("Content-Type"), "text/event-stream")
	events := readSSEEvents(t, w.Body.String())
	require.Len(t, events, 3)
	assert.Equal(t, "start", events[0].Type)
	assert.Equal(t, "request", events[1].Type)
	assert.Equal(t, "done", events[2].Type)
}

func TestHandleRunStream_LiveStreaming(t *testing.T) {
	s := testServer(t)
	ch := make(chan runEvent, 10)
	entry := &runEntry{ch: ch}
	s.runs.Store("r2", entry)
	mux := s.newMux(testFS())

	// Pre-fill the channel with events and close it.
	ch <- runEvent{Type: "start", Total: 1, Iterations: 1}
	ch <- runEvent{Type: "request", Name: "req1", Passed: true}
	summary := &runSummary{RunID: "r2", Total: 1, Passed: 1}
	ch <- runEvent{Type: "done", Summary: summary}
	close(ch)

	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/runs/r2/stream", nil))

	events := readSSEEvents(t, w.Body.String())
	require.Len(t, events, 3)
	assert.Equal(t, "start", events[0].Type)
	assert.Equal(t, "request", events[1].Type)
	assert.Equal(t, "done", events[2].Type)
	assert.Equal(t, "r2", events[2].Summary.RunID)
}

func TestHandleRunStream_DoneEmptyEvents(t *testing.T) {
	s := testServer(t)
	entry := &runEntry{
		ch:   make(chan runEvent, 10),
		done: true,
		// no events
	}
	s.runs.Store("r-empty", entry)
	mux := s.newMux(testFS())

	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/runs/r-empty/stream", nil))

	assert.Contains(t, w.Header().Get("Content-Type"), "text/event-stream")
	assert.Empty(t, readSSEEvents(t, w.Body.String()))
}

// ---- helpers ----

func TestCountRequests(t *testing.T) {
	colJSON := makeTestCollection("col-count", "CountTest", []string{"r1", "r2"})
	// Add a folder with one more request manually.
	var col map[string]any
	require.NoError(t, json.Unmarshal(colJSON, &col))
	items := col["items"].([]any)
	folder := map[string]any{
		"id":   "folder-1",
		"name": "folder",
		"items": []any{
			map[string]any{
				"id":      "req-3",
				"name":    "r3",
				"method":  "GET",
				"url":     "https://example.com/r3",
				"params":  []any{},
				"headers": []any{},
				"auth":    map[string]any{"type": "none"},
			},
		},
		"auth": map[string]any{"type": "none"},
	}
	col["items"] = append(items, folder)
	data, err := json.Marshal(col)
	require.NoError(t, err)

	parsed, err := CollectionToParser(data)
	require.NoError(t, err)
	assert.Equal(t, 3, countRequests(parsed.Item))
}

func TestBuildRunSummary(t *testing.T) {
	tests := []struct {
		name       string
		result     *runner.RunResult
		wantTotal  int
		wantPassed int
		wantFailed int
	}{
		{
			name:       "all passed",
			result:     makeRunResult([]bool{true, true}),
			wantTotal:  2,
			wantPassed: 2,
			wantFailed: 0,
		},
		{
			name:       "one failed",
			result:     makeRunResult([]bool{true, false}),
			wantTotal:  2,
			wantPassed: 1,
			wantFailed: 1,
		},
		{
			name:       "empty run",
			result:     makeRunResult(nil),
			wantTotal:  0,
			wantPassed: 0,
			wantFailed: 0,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := buildRunSummary("rid", "cid", time.Now(), tt.result)
			assert.Equal(t, tt.wantTotal, got.Total)
			assert.Equal(t, tt.wantPassed, got.Passed)
			assert.Equal(t, tt.wantFailed, got.Failed)
			assert.Equal(t, "rid", got.RunID)
			assert.Equal(t, "cid", got.CollectionID)
		})
	}
}

func TestBuildRunSummary_SkippedNotCounted(t *testing.T) {
	result := &runner.RunResult{
		Name: "col",
		Iterations: []runner.IterationResult{
			{
				Index: 0,
				Requests: []runner.RequestResult{
					{Name: "req1", Skipped: true},
					{Name: "req2"},
				},
			},
		},
	}
	got := buildRunSummary("rid", "cid", time.Now(), result)
	assert.Equal(t, 1, got.Total, "skipped requests should not be counted")
	assert.Equal(t, 1, got.Passed)
	assert.Equal(t, 0, got.Failed)
}

// ---- noopSandbox ----

func TestNoopSandbox_ExecuteAndClose(t *testing.T) {
	var sb noopSandbox
	result, err := sb.Execute(context.Background(), "script", "test", (*sandbox.ScriptContext)(nil))
	assert.NoError(t, err)
	assert.NotNil(t, result)
	assert.NoError(t, sb.Close())
}

// ---- collectReqInfo ----

func TestBuildRequestInfoMap_SkipsNilRequest(t *testing.T) {
	items := []parser.Item{
		{Name: "no-request"}, // not a folder, Request == nil — must be skipped
		{Name: "has-request", Request: &parser.Request{Method: "DELETE", URL: parser.URL{Raw: "/x"}}},
	}
	m := buildRequestInfoMap(items)
	require.Len(t, m, 1)
	assert.Equal(t, "DELETE", m["has-request"].method)
	_, ok := m["no-request"]
	assert.False(t, ok)
}

func TestBuildRequestInfoMap_RecursesIntoFolder(t *testing.T) {
	items := []parser.Item{
		{Name: "top", Request: &parser.Request{Method: "GET", URL: parser.URL{Raw: "/top"}}},
		{
			Name: "folder",
			Item: []parser.Item{
				{Name: "nested", Request: &parser.Request{Method: "POST", URL: parser.URL{Raw: "/nested"}}},
			},
		},
	}
	m := buildRequestInfoMap(items)
	require.Len(t, m, 2)
	assert.Equal(t, "GET", m["top"].method)
	assert.Equal(t, "POST", m["nested"].method)
}

// ---- handleRunStream without http.Flusher ----

// nonFlusherWriter is an http.ResponseWriter that does not implement http.Flusher.
type nonFlusherWriter struct {
	code   int
	header http.Header
	body   bytes.Buffer
}

func (w *nonFlusherWriter) Header() http.Header {
	if w.header == nil {
		w.header = make(http.Header)
	}
	return w.header
}
func (w *nonFlusherWriter) Write(b []byte) (int, error) { return w.body.Write(b) }
func (w *nonFlusherWriter) WriteHeader(code int)        { w.code = code }

func TestHandleRunStream_NotFlushable(t *testing.T) {
	s := testServer(t)
	entry := &runEntry{ch: make(chan runEvent, 10)}
	s.runs.Store("r-noflush", entry)
	mux := s.newMux(testFS())

	w := &nonFlusherWriter{}
	req := httptest.NewRequest(http.MethodGet, "/api/runs/r-noflush/stream", nil)
	mux.ServeHTTP(w, req)

	assert.Equal(t, http.StatusInternalServerError, w.code)
}

// ---- handleRunCollection store error (non-NotFound) ----

func TestHandleRunCollection_StoreError(t *testing.T) {
	s := testServer(t)
	// A directory at the collection path triggers a read error that is not errNotFound.
	require.NoError(t, os.MkdirAll(s.collections.path("col-store-err"), 0o750))
	mux := s.newMux(testFS())

	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/api/collections/col-store-err/run", nil))

	assert.Equal(t, http.StatusInternalServerError, w.Code)
}

// ---- handleRunCollection with environment ----

func TestHandleRunCollection_WithEnvironmentID(t *testing.T) {
	backend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer backend.Close()

	s := testServer(t)
	colJSON := buildColJSON("col-env", "EnvCol", []string{"req1"}, backend.URL)
	colID := saveCollection(t, s, colJSON)

	envJSON := `{"id":"env-test","name":"Test Env","variables":[]}`
	require.NoError(t, s.environments.save("env-test", json.RawMessage(envJSON)))

	mux := s.newMux(testFS())
	body := `{"iterations":1,"environmentId":"env-test"}`
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/api/collections/"+colID+"/run",
		strings.NewReader(body)))

	require.Equal(t, http.StatusAccepted, w.Code)
	var resp map[string]string
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.NotEmpty(t, resp["runId"])
}

func TestHandleRunCollection_WithMissingEnvironmentID(t *testing.T) {
	s := testServer(t)
	colJSON := makeTestCollection("col-noenv", "NoEnvCol", []string{"req1"})
	colID := saveCollection(t, s, colJSON)
	mux := s.newMux(testFS())

	body := `{"iterations":1,"environmentId":"does-not-exist"}`
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/api/collections/"+colID+"/run",
		strings.NewReader(body)))

	// Run starts normally even if the environment is not found.
	assert.Equal(t, http.StatusAccepted, w.Code)
}

// ---- end-to-end: goroutine completes, SSE events received ----

func TestHandleRunCollection_EndToEnd(t *testing.T) {
	backend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))
	defer backend.Close()

	s := testServer(t)
	colJSON := buildColJSON("col-e2e", "E2E", []string{"reqA", "reqB"}, backend.URL)
	colID := saveCollection(t, s, colJSON)
	mux := s.newMux(testFS())

	// Start the run.
	w1 := httptest.NewRecorder()
	mux.ServeHTTP(w1, httptest.NewRequest(http.MethodPost, "/api/collections/"+colID+"/run", nil))
	require.Equal(t, http.StatusAccepted, w1.Code)
	var resp map[string]string
	require.NoError(t, json.NewDecoder(w1.Body).Decode(&resp))
	runID := resp["runId"]
	require.NotEmpty(t, runID)

	// Stream events — blocks until goroutine closes the channel.
	w2 := httptest.NewRecorder()
	mux.ServeHTTP(w2, httptest.NewRequest(http.MethodGet, "/api/runs/"+runID+"/stream", nil))

	events := readSSEEvents(t, w2.Body.String())
	require.NotEmpty(t, events)
	assert.Equal(t, "start", events[0].Type)

	last := events[len(events)-1]
	assert.Equal(t, "done", last.Type)
	require.NotNil(t, last.Summary)
	assert.Equal(t, runID, last.Summary.RunID)
	assert.Equal(t, 2, last.Summary.Total)
}

func TestHandleRunCollection_EndToEnd_WithResponse(t *testing.T) {
	backend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer backend.Close()

	s := testServer(t)
	colJSON := buildColJSON("col-resp", "RespTest", []string{"req1"}, backend.URL)
	colID := saveCollection(t, s, colJSON)
	mux := s.newMux(testFS())

	w1 := httptest.NewRecorder()
	mux.ServeHTTP(w1, httptest.NewRequest(http.MethodPost, "/api/collections/"+colID+"/run", nil))
	require.Equal(t, http.StatusAccepted, w1.Code)

	var resp map[string]string
	require.NoError(t, json.NewDecoder(w1.Body).Decode(&resp))
	runID := resp["runId"]

	w2 := httptest.NewRecorder()
	mux.ServeHTTP(w2, httptest.NewRequest(http.MethodGet, "/api/runs/"+runID+"/stream", nil))

	events := readSSEEvents(t, w2.Body.String())
	var reqEvent *runEvent
	for i := range events {
		if events[i].Type == "request" {
			reqEvent = &events[i]
			break
		}
	}
	require.NotNil(t, reqEvent, "expected at least one request event")
	assert.Equal(t, http.StatusOK, reqEvent.Status, "status from response must be propagated")
	assert.Greater(t, reqEvent.DurationMs, int64(-1))
}

// ---- handleGetRun after run completes ----

func TestHandleGetRun_AfterEndToEnd(t *testing.T) {
	backend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer backend.Close()

	s := testServer(t)
	colJSON := buildColJSON("col-get", "GetTest", []string{"req1"}, backend.URL)
	colID := saveCollection(t, s, colJSON)
	mux := s.newMux(testFS())

	w1 := httptest.NewRecorder()
	mux.ServeHTTP(w1, httptest.NewRequest(http.MethodPost, "/api/collections/"+colID+"/run", nil))
	require.Equal(t, http.StatusAccepted, w1.Code)
	var resp map[string]string
	require.NoError(t, json.NewDecoder(w1.Body).Decode(&resp))
	runID := resp["runId"]

	// Wait for completion via SSE stream.
	w2 := httptest.NewRecorder()
	mux.ServeHTTP(w2, httptest.NewRequest(http.MethodGet, "/api/runs/"+runID+"/stream", nil))

	// Now GET the run summary.
	w3 := httptest.NewRecorder()
	mux.ServeHTTP(w3, httptest.NewRequest(http.MethodGet, "/api/runs/"+runID, nil))

	require.Equal(t, http.StatusOK, w3.Code)
	var summary runSummary
	require.NoError(t, json.NewDecoder(w3.Body).Decode(&summary))
	assert.Equal(t, runID, summary.RunID)
	assert.Equal(t, 1, summary.Total)
}

// ---- handleRunCollection with non-nil sandbox ----

func TestHandleRunCollection_WithSandbox(t *testing.T) {
	backend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer backend.Close()

	s := testServer(t)
	s.sandbox = noopSandbox{} // non-nil — exercises the `sb = s.sandbox` branch
	colJSON := buildColJSON("col-sb", "SandboxTest", []string{"req1"}, backend.URL)
	colID := saveCollection(t, s, colJSON)
	mux := s.newMux(testFS())

	w1 := httptest.NewRecorder()
	mux.ServeHTTP(w1, httptest.NewRequest(http.MethodPost, "/api/collections/"+colID+"/run", nil))
	require.Equal(t, http.StatusAccepted, w1.Code)
	var resp map[string]string
	require.NoError(t, json.NewDecoder(w1.Body).Decode(&resp))
	runID := resp["runId"]

	// Stream until done to let the goroutine complete.
	w2 := httptest.NewRecorder()
	mux.ServeHTTP(w2, httptest.NewRequest(http.MethodGet, "/api/runs/"+runID+"/stream", nil))

	events := readSSEEvents(t, w2.Body.String())
	require.NotEmpty(t, events)
	assert.Equal(t, "done", events[len(events)-1].Type)
}

// ---- handleRunStream client disconnect ----

func TestHandleRunStream_ClientDisconnect(t *testing.T) {
	s := testServer(t)
	ch := make(chan runEvent) // unbuffered — will never deliver an event before cancel
	entry := &runEntry{ch: ch}
	s.runs.Store("r-ctx", entry)
	mux := s.newMux(testFS())

	ctx, cancel := context.WithCancel(context.Background())
	req := httptest.NewRequest(http.MethodGet, "/api/runs/r-ctx/stream", nil).WithContext(ctx)
	w := httptest.NewRecorder()

	// Cancel the request context after a short delay so the handler exits via ctx.Done().
	go func() {
		time.Sleep(20 * time.Millisecond)
		cancel()
	}()

	mux.ServeHTTP(w, req) // blocks until ctx cancelled or channel closed

	assert.Contains(t, w.Header().Get("Content-Type"), "text/event-stream")
	cancel() // idempotent — avoids goroutine leak
}

// buildColJSON returns frontend-format collection JSON with requests pointing to baseURL.
func buildColJSON(id, name string, requests []string, baseURL string) []byte {
	items := make([]map[string]any, len(requests))
	for i, rname := range requests {
		items[i] = map[string]any{
			"id":      fmt.Sprintf("req-%d", i),
			"name":    rname,
			"method":  "GET",
			"url":     baseURL + "/" + rname,
			"params":  []any{},
			"headers": []any{},
			"auth":    map[string]any{"type": "none"},
		}
	}
	col := map[string]any{
		"id":               id,
		"name":             name,
		"description":      "",
		"items":            items,
		"variables":        []any{},
		"preRequestScript": "",
		"testScript":       "",
		"auth":             map[string]any{"type": "none"},
	}
	data, _ := json.Marshal(col)
	return data
}

// makeRunResult builds a RunResult with one iteration and one request per bool.
func makeRunResult(passed []bool) *runner.RunResult {
	reqs := make([]runner.RequestResult, len(passed))
	for i, p := range passed {
		if !p {
			reqs[i] = runner.RequestResult{Name: "req", Error: fmt.Errorf("failed")}
		} else {
			reqs[i] = runner.RequestResult{Name: "req"}
		}
	}
	return &runner.RunResult{
		Name:       "col",
		Iterations: []runner.IterationResult{{Index: 0, Requests: reqs}},
	}
}
