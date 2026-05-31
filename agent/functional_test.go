//go:build functional

package main

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
	"time"

	"github.com/guillaumedelre/reqlet/engine/sandbox"
	"github.com/guillaumedelre/reqlet/engine/storage"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// functionalRunnerPath resolves runner/src/index.js relative to this file.
func functionalRunnerPath(t *testing.T) string {
	t.Helper()
	_, file, _, ok := runtime.Caller(0)
	require.True(t, ok)
	return filepath.Join(filepath.Dir(file), "..", "runner", "src", "index.js")
}

// openAgentOnDir opens a full agent (collections, environments, storage, sandbox)
// rooted at dir and returns the test server plus an explicit closer.
func openAgentOnDir(t *testing.T, dir string) (*httptest.Server, func()) {
	t.Helper()
	cols, err := newJSONStore(filepath.Join(dir, "collections"))
	require.NoError(t, err)
	envs, err := newJSONStore(filepath.Join(dir, "environments"))
	require.NoError(t, err)

	st, err := storage.New("file:" + filepath.Join(dir, "test.db") + "?cache=shared")
	require.NoError(t, err)

	sbRunner, err := sandbox.NewRunner(functionalRunnerPath(t))
	require.NoError(t, err)

	s := &server{collections: cols, environments: envs, sandbox: sbRunner, storage: st}
	ts := httptest.NewServer(s.newMux(testFS()))

	return ts, func() {
		ts.Close()
		_ = sbRunner.Close()
		_ = st.Close()
	}
}

// newFunctionalServer starts an agent in a temp dir and registers cleanup.
func newFunctionalServer(t *testing.T) *httptest.Server {
	t.Helper()
	ts, closer := openAgentOnDir(t, t.TempDir())
	t.Cleanup(closer)
	return ts
}

// readSSEFromURL reads SSE events from url until a "done" or "error" event,
// or until the given timeout elapses.
func readSSEFromURL(t *testing.T, url string, timeout time.Duration) []runEvent {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	require.NoError(t, err)

	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	var events []runEvent
	scanner := bufio.NewScanner(resp.Body)
	for scanner.Scan() {
		line := scanner.Text()
		if !strings.HasPrefix(line, "data: ") {
			continue
		}
		var evt runEvent
		if err := json.Unmarshal([]byte(strings.TrimPrefix(line, "data: ")), &evt); err != nil {
			continue
		}
		events = append(events, evt)
		if evt.Type == "done" || evt.Type == "error" {
			break
		}
	}
	return events
}

// postJSON sends a POST request with a JSON body and decodes the response.
func postJSON(t *testing.T, url string, body any, out any) *http.Response {
	t.Helper()
	data, err := json.Marshal(body)
	require.NoError(t, err)
	resp, err := http.Post(url, "application/json", bytes.NewReader(data)) //nolint:noctx
	require.NoError(t, err)
	if out != nil {
		defer resp.Body.Close()
		require.NoError(t, json.NewDecoder(resp.Body).Decode(out))
	}
	return resp
}

func getJSON(t *testing.T, url string, out any) *http.Response {
	t.Helper()
	resp, err := http.Get(url) //nolint:noctx
	require.NoError(t, err)
	if out != nil {
		defer resp.Body.Close()
		require.NoError(t, json.NewDecoder(resp.Body).Decode(out))
	}
	return resp
}

// minimalPostmanCollection builds a Postman v2.1 collection JSON with n GET requests to url.
func minimalPostmanCollection(name, backendURL string, count int, failFirst bool) []byte {
	makeItem := func(i int) map[string]any {
		item := map[string]any{
			"name": fmt.Sprintf("Request %d", i+1),
			"request": map[string]any{
				"method": "GET",
				"header": []any{},
				"url":    map[string]any{"raw": backendURL + "/ok"},
			},
		}
		if failFirst && i == 0 {
			item["event"] = []any{
				map[string]any{
					"listen": "test",
					"script": map[string]any{
						"type": "text/javascript",
						"exec": []string{`pm.test("fail", () => { throw new Error("bail") })`},
					},
				},
			}
		}
		return item
	}

	items := make([]any, count)
	for i := range items {
		items[i] = makeItem(i)
	}

	col := map[string]any{
		"info": map[string]any{
			"name":   name,
			"schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
		},
		"item": items,
	}
	b, _ := json.Marshal(col)
	return b
}

// A1 — Send simple GET to real backend, verify response and history entry.
func TestFunctional_A1_SendSimple(t *testing.T) {
	backend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"hello":"world"}`))
	}))
	defer backend.Close()

	ts := newFunctionalServer(t)

	var result sendResp
	resp := postJSON(t, ts.URL+"/api/send", map[string]any{
		"method":          "GET",
		"url":             backend.URL + "/ok",
		"headers":         []any{},
		"sslVerification": true,
	}, &result)
	assert.Equal(t, http.StatusOK, resp.StatusCode)

	assert.Equal(t, 200, result.Status)
	assert.Contains(t, result.Body, "hello")
	assert.GreaterOrEqual(t, result.Timings.Total, int64(0))

	// Verify history was recorded.
	var history []json.RawMessage
	getJSON(t, ts.URL+"/api/history", &history)
	assert.NotEmpty(t, history)
}

// A2 — Script pre-request reads environment variables passed in the request body.
func TestFunctional_A2_ScriptReadsEnvironmentVariables(t *testing.T) {
	backend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"ok":true}`))
	}))
	defer backend.Close()

	ts := newFunctionalServer(t)

	var result sendResp
	resp := postJSON(t, ts.URL+"/api/send", map[string]any{
		"method":          "GET",
		"url":             backend.URL + "/ok",
		"headers":         []any{},
		"sslVerification": true,
		"variables": map[string]any{
			"environment": map[string]string{"myKey": "myValue"},
		},
		"testScript": "pm.test('env var accessible', () => pm.expect(pm.environment.get('myKey')).to.equal('myValue'))",
	}, &result)
	assert.Equal(t, http.StatusOK, resp.StatusCode)
	require.Len(t, result.TestResults, 1)
	assert.True(t, result.TestResults[0].Passed)
}

// A3 — Pre-request script mutations are returned in the response.
func TestFunctional_A3_PreRequestScriptMutations(t *testing.T) {
	backend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"ok":true}`))
	}))
	defer backend.Close()

	ts := newFunctionalServer(t)

	var result sendResp
	resp := postJSON(t, ts.URL+"/api/send", map[string]any{
		"method":           "GET",
		"url":              backend.URL + "/ok",
		"headers":          []any{},
		"sslVerification":  true,
		"preRequestScript": "pm.environment.set('token', 'secret-abc')",
	}, &result)
	assert.Equal(t, http.StatusOK, resp.StatusCode)
	require.NotNil(t, result.Mutations)
	assert.Equal(t, "secret-abc", result.Mutations.Environment["token"])
}

// A4 — Test script validates the response; results are in the JSON response.
func TestFunctional_A4_TestScriptValidatesResponse(t *testing.T) {
	backend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"ok":true}`))
	}))
	defer backend.Close()

	ts := newFunctionalServer(t)

	var result sendResp
	resp := postJSON(t, ts.URL+"/api/send", map[string]any{
		"method":          "GET",
		"url":             backend.URL + "/ok",
		"headers":         []any{},
		"sslVerification": true,
		"testScript": strings.Join([]string{
			"pm.test('status ok', () => pm.expect(pm.response.code).to.equal(200));",
			"pm.test('body ok', () => pm.expect(pm.response.json().ok).to.be.true);",
		}, "\n"),
	}, &result)
	assert.Equal(t, http.StatusOK, resp.StatusCode)
	require.Len(t, result.TestResults, 2)
	assert.Equal(t, "status ok", result.TestResults[0].Name)
	assert.True(t, result.TestResults[0].Passed)
	assert.Equal(t, "body ok", result.TestResults[1].Name)
	assert.True(t, result.TestResults[1].Passed)
}

// A5 — Run collection 2 requests × 2 iterations: SSE events and final summary.
func TestFunctional_A5_RunCollection_SSE(t *testing.T) {
	hits := 0
	backend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		hits++
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"ok":true}`))
	}))
	defer backend.Close()

	ts := newFunctionalServer(t)

	colJSON := minimalPostmanCollection("SSE Test", backend.URL, 2, false)
	var importResult map[string]any
	importResp := postJSON(t, ts.URL+"/api/collections/import",
		json.RawMessage(colJSON), &importResult)
	require.Equal(t, http.StatusCreated, importResp.StatusCode)
	colID, _ := importResult["id"].(string)
	require.NotEmpty(t, colID)

	var startResult map[string]string
	runResp := postJSON(t, fmt.Sprintf("%s/api/collections/%s/run", ts.URL, colID),
		map[string]any{"iterations": 2}, &startResult)
	require.Equal(t, http.StatusAccepted, runResp.StatusCode)
	runID := startResult["runId"]
	require.NotEmpty(t, runID)

	events := readSSEFromURL(t, fmt.Sprintf("%s/api/runs/%s/stream", ts.URL, runID), 15*time.Second)

	requestEvents := make([]runEvent, 0)
	var doneEvent *runEvent
	for i := range events {
		switch events[i].Type {
		case "request":
			requestEvents = append(requestEvents, events[i])
		case "done":
			doneEvent = &events[i]
		}
	}

	assert.Len(t, requestEvents, 4, "expected 2 requests × 2 iterations")
	require.NotNil(t, doneEvent)
	require.NotNil(t, doneEvent.Summary)
	assert.Equal(t, 4, doneEvent.Summary.Total)
	assert.Equal(t, 0, doneEvent.Summary.Failed)
	assert.Equal(t, 4, hits)

	// GET /api/runs/{runId} returns the summary.
	var summary runSummary
	getJSON(t, fmt.Sprintf("%s/api/runs/%s", ts.URL, runID), &summary)
	assert.Equal(t, 4, summary.Total)
}

// A6 — Run with bail stops after the first failing test.
func TestFunctional_A6_RunCollection_Bail(t *testing.T) {
	hits := 0
	backend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		hits++
		_, _ = w.Write([]byte(`{}`))
	}))
	defer backend.Close()

	ts := newFunctionalServer(t)

	// Collection: 3 requests, first one has a failing test script.
	colJSON := minimalPostmanCollection("Bail Test", backend.URL, 3, true)
	var importResult map[string]any
	importResp := postJSON(t, ts.URL+"/api/collections/import",
		json.RawMessage(colJSON), &importResult)
	require.Equal(t, http.StatusCreated, importResp.StatusCode)
	colID, _ := importResult["id"].(string)

	var startResult map[string]string
	runResp := postJSON(t, fmt.Sprintf("%s/api/collections/%s/run", ts.URL, colID),
		map[string]any{"iterations": 1, "bail": true}, &startResult)
	require.Equal(t, http.StatusAccepted, runResp.StatusCode)

	events := readSSEFromURL(t, fmt.Sprintf("%s/api/runs/%s/stream", ts.URL, startResult["runId"]), 15*time.Second)

	var doneEvent *runEvent
	for i := range events {
		if events[i].Type == "done" {
			doneEvent = &events[i]
			break
		}
	}

	require.NotNil(t, doneEvent)
	require.NotNil(t, doneEvent.Summary)
	assert.Equal(t, 1, doneEvent.Summary.Total, "only 1 request should have run (bail)")
	assert.Equal(t, 1, doneEvent.Summary.Failed)
	assert.Equal(t, 1, hits, "backend should receive only 1 request")
}

// A7 — DELETE /api/send/{id} cancels an in-flight request.
func TestFunctional_A7_CancelSend(t *testing.T) {
	slowBackend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		time.Sleep(5 * time.Second)
		_, _ = w.Write([]byte(`{"slow":true}`))
	}))
	defer slowBackend.Close()

	ts := newFunctionalServer(t)

	type sendResult struct {
		statusCode int
		err        error
	}
	sendDone := make(chan sendResult, 1)

	go func() {
		body, _ := json.Marshal(map[string]any{
			"method":          "GET",
			"url":             slowBackend.URL + "/slow",
			"headers":         []any{},
			"requestId":       "req-cancel",
			"sslVerification": false,
		})
		resp, err := http.Post(ts.URL+"/api/send", "application/json", bytes.NewReader(body)) //nolint:noctx
		code := 0
		if resp != nil {
			code = resp.StatusCode
			_ = resp.Body.Close()
		}
		sendDone <- sendResult{code, err}
	}()

	// Allow the handler to register the cancel function.
	time.Sleep(150 * time.Millisecond)

	req, err := http.NewRequest(http.MethodDelete, ts.URL+"/api/send/req-cancel", nil)
	require.NoError(t, err)
	delResp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	_ = delResp.Body.Close()
	assert.Equal(t, http.StatusNoContent, delResp.StatusCode)

	select {
	case result := <-sendDone:
		require.NoError(t, result.err)
		// Context cancellation causes the HTTP call to fail → 422 Unprocessable Entity.
		assert.Equal(t, http.StatusUnprocessableEntity, result.statusCode)
	case <-time.After(2 * time.Second):
		t.Fatal("send did not return within 2s after cancel")
	}
}

// A8 — Import Postman v2.1 collection → export → round-trip structural check.
func TestFunctional_A8_ImportExportRoundTrip(t *testing.T) {
	colJSON := `{
		"info": {
			"_postman_id": "round-trip-id",
			"name": "RoundTrip",
			"schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
		},
		"item": [
			{
				"name": "Folder A",
				"item": [
					{
						"name": "Get Users",
						"request": {
							"method": "GET",
							"header": [{"key": "Accept", "value": "application/json"}],
							"url": {
								"raw": "https://api.example.com/users",
								"protocol": "https",
								"host": ["api", "example", "com"],
								"path": ["users"]
							}
						},
						"event": [
							{"listen": "test", "script": {"type": "text/javascript", "exec": ["pm.test('ok', () => true)"]}}
						]
					}
				]
			}
		],
		"auth": {
			"type": "bearer",
			"bearer": [{"key": "token", "value": "mytoken", "type": "string"}]
		},
		"variable": [{"key": "base", "value": "https://api.example.com"}]
	}`

	ts := newFunctionalServer(t)

	var importResult map[string]any
	importResp := postJSON(t, ts.URL+"/api/collections/import", json.RawMessage(colJSON), &importResult)
	require.Equal(t, http.StatusCreated, importResp.StatusCode)
	colID, _ := importResult["id"].(string)
	require.NotEmpty(t, colID)

	exportResp, err := http.Get(fmt.Sprintf("%s/api/collections/%s/export", ts.URL, colID)) //nolint:noctx
	require.NoError(t, err)
	defer exportResp.Body.Close()
	assert.Equal(t, http.StatusOK, exportResp.StatusCode)

	var exported map[string]any
	require.NoError(t, json.NewDecoder(exportResp.Body).Decode(&exported))

	info, _ := exported["info"].(map[string]any)
	require.NotNil(t, info)
	assert.Contains(t, info["schema"].(string), "v2.1.0")
	assert.Equal(t, "RoundTrip", info["name"])

	items, _ := exported["item"].([]any)
	assert.Len(t, items, 1, "one top-level folder expected")
}

// A9 — CRUD collections full cycle.
func TestFunctional_A9_CRUDCollections(t *testing.T) {
	ts := newFunctionalServer(t)

	// List → empty.
	var list []json.RawMessage
	getJSON(t, ts.URL+"/api/collections", &list)
	assert.Empty(t, list)

	// Create.
	const id = "col-crud"
	resp := postJSON(t, ts.URL+"/api/collections",
		map[string]any{"id": id, "name": "CRUD Collection"}, nil)
	assert.Equal(t, http.StatusCreated, resp.StatusCode)
	_ = resp.Body.Close()

	// Get.
	var got map[string]any
	getJSON(t, ts.URL+"/api/collections/"+id, &got)
	assert.Equal(t, "CRUD Collection", got["name"])

	// Update.
	updateBody, _ := json.Marshal(map[string]any{"id": id, "name": "Updated"})
	req, _ := http.NewRequest(http.MethodPut, ts.URL+"/api/collections/"+id, bytes.NewReader(updateBody))
	req.Header.Set("Content-Type", "application/json")
	putResp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	_ = putResp.Body.Close()
	assert.Equal(t, http.StatusOK, putResp.StatusCode)

	var updated map[string]any
	getJSON(t, ts.URL+"/api/collections/"+id, &updated)
	assert.Equal(t, "Updated", updated["name"])

	// Delete.
	delReq, _ := http.NewRequest(http.MethodDelete, ts.URL+"/api/collections/"+id, nil)
	delResp, err := http.DefaultClient.Do(delReq)
	require.NoError(t, err)
	_ = delResp.Body.Close()
	assert.Equal(t, http.StatusNoContent, delResp.StatusCode)

	// Get → 404.
	notFound, err := http.Get(ts.URL + "/api/collections/" + id) //nolint:noctx
	require.NoError(t, err)
	_ = notFound.Body.Close()
	assert.Equal(t, http.StatusNotFound, notFound.StatusCode)

	// List → empty again.
	getJSON(t, ts.URL+"/api/collections", &list)
	assert.Empty(t, list)
}

// A10 — CRUD environments full cycle.
func TestFunctional_A10_CRUDEnvironments(t *testing.T) {
	ts := newFunctionalServer(t)

	var list []json.RawMessage
	getJSON(t, ts.URL+"/api/environments", &list)
	assert.Empty(t, list)

	const id = "env-crud"
	resp := postJSON(t, ts.URL+"/api/environments",
		map[string]any{
			"id":        id,
			"name":      "Env CRUD",
			"variables": []map[string]any{{"key": "k", "initialValue": "v", "currentValue": "v", "enabled": true}},
		}, nil)
	assert.Equal(t, http.StatusCreated, resp.StatusCode)
	_ = resp.Body.Close()

	var got map[string]any
	getJSON(t, ts.URL+"/api/environments/"+id, &got)
	assert.Equal(t, "Env CRUD", got["name"])

	updateBody, _ := json.Marshal(map[string]any{"id": id, "name": "Env Updated", "variables": []any{}})
	req, _ := http.NewRequest(http.MethodPut, ts.URL+"/api/environments/"+id, bytes.NewReader(updateBody))
	req.Header.Set("Content-Type", "application/json")
	putResp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	_ = putResp.Body.Close()
	assert.Equal(t, http.StatusOK, putResp.StatusCode)

	var updated map[string]any
	getJSON(t, ts.URL+"/api/environments/"+id, &updated)
	assert.Equal(t, "Env Updated", updated["name"])

	delReq, _ := http.NewRequest(http.MethodDelete, ts.URL+"/api/environments/"+id, nil)
	delResp, err := http.DefaultClient.Do(delReq)
	require.NoError(t, err)
	_ = delResp.Body.Close()
	assert.Equal(t, http.StatusNoContent, delResp.StatusCode)

	notFound, err := http.Get(ts.URL + "/api/environments/" + id) //nolint:noctx
	require.NoError(t, err)
	_ = notFound.Body.Close()
	assert.Equal(t, http.StatusNotFound, notFound.StatusCode)
}

// A11 — SQLite data persists across two server instances.
func TestFunctional_A11_SQLitePersistence(t *testing.T) {
	dir := t.TempDir()

	// First instance: create a collection and configure settings.
	ts1, close1 := openAgentOnDir(t, dir)

	const colID = "persist-col"
	resp := postJSON(t, ts1.URL+"/api/collections",
		map[string]any{"id": colID, "name": "Persist Me"}, nil)
	require.Equal(t, http.StatusCreated, resp.StatusCode)
	_ = resp.Body.Close()

	settingsBody, _ := json.Marshal(map[string]any{"maxResponseSizeMB": 99})
	req, _ := http.NewRequest(http.MethodPut, ts1.URL+"/api/settings", bytes.NewReader(settingsBody))
	req.Header.Set("Content-Type", "application/json")
	putResp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	_ = putResp.Body.Close()

	close1()

	// Second instance on the same dir.
	ts2, close2 := openAgentOnDir(t, dir)
	defer close2()

	// Collection must still be there.
	var got map[string]any
	getJSON(t, ts2.URL+"/api/collections/"+colID, &got)
	assert.Equal(t, "Persist Me", got["name"])

	// Settings must still be there.
	var settings map[string]any
	getJSON(t, ts2.URL+"/api/settings", &settings)
	assert.Equal(t, float64(99), settings["maxResponseSizeMB"])
}

// A12 — Settings PUT then GET across two instances.
func TestFunctional_A12_SettingsPersist(t *testing.T) {
	dir := t.TempDir()

	ts1, close1 := openAgentOnDir(t, dir)

	body, _ := json.Marshal(map[string]any{"proxyUrl": "http://proxy:3128", "sslVerification": false, "maxResponseSizeMB": 100})
	req, _ := http.NewRequest(http.MethodPut, ts1.URL+"/api/settings", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	putResp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	_ = putResp.Body.Close()
	assert.Equal(t, http.StatusOK, putResp.StatusCode)

	var before map[string]any
	getJSON(t, ts1.URL+"/api/settings", &before)
	assert.Equal(t, "http://proxy:3128", before["proxyUrl"])
	assert.Equal(t, false, before["sslVerification"])
	assert.Equal(t, float64(100), before["maxResponseSizeMB"])

	close1()

	ts2, close2 := openAgentOnDir(t, dir)
	defer close2()

	var after map[string]any
	getJSON(t, ts2.URL+"/api/settings", &after)
	assert.Equal(t, "http://proxy:3128", after["proxyUrl"])
	assert.Equal(t, false, after["sslVerification"])
	assert.Equal(t, float64(100), after["maxResponseSizeMB"])
}
