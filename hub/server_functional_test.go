//go:build functional

package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newFunctionalServer(t *testing.T) *httptest.Server {
	t.Helper()
	s := NewServer(":0")
	ts := httptest.NewServer(s.router)
	t.Cleanup(ts.Close)
	return ts
}

// H1 — Health endpoint: real TCP round-trip, correct JSON body.
func TestFunctional_H1_HealthEndpoint(t *testing.T) {
	ts := newFunctionalServer(t)

	resp, err := http.Get(ts.URL + "/api/health") //nolint:noctx
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode)

	var body map[string]string
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	assert.Equal(t, "ok", body["status"])
}

// H2 — 50 concurrent requests on /api/health: no panics, all 200.
func TestFunctional_H2_ConcurrentRequests(t *testing.T) {
	ts := newFunctionalServer(t)

	type result struct {
		status int
		body   map[string]string
		err    error
	}
	results := make([]result, 50)

	var wg sync.WaitGroup
	for i := range results {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			resp, err := http.Get(ts.URL + "/api/health") //nolint:noctx
			if err != nil {
				results[idx] = result{err: err}
				return
			}
			defer resp.Body.Close()
			var body map[string]string
			_ = json.NewDecoder(resp.Body).Decode(&body)
			results[idx] = result{status: resp.StatusCode, body: body}
		}(i)
	}
	wg.Wait()

	for i, r := range results {
		require.NoError(t, r.err, "goroutine %d", i)
		assert.Equal(t, http.StatusOK, r.status, "goroutine %d", i)
		assert.Equal(t, "ok", r.body["status"], "goroutine %d", i)
	}
}

// H3 — POST and PUT on /api/health → 405 (chi enforces method restriction).
func TestFunctional_H3_MethodNotAllowed(t *testing.T) {
	ts := newFunctionalServer(t)

	postResp, err := http.Post(ts.URL+"/api/health", "", nil) //nolint:noctx
	require.NoError(t, err)
	_ = postResp.Body.Close()
	assert.Equal(t, http.StatusMethodNotAllowed, postResp.StatusCode)

	req, err := http.NewRequest(http.MethodPut, ts.URL+"/api/health", nil)
	require.NoError(t, err)
	putResp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	_ = putResp.Body.Close()
	assert.Equal(t, http.StatusMethodNotAllowed, putResp.StatusCode)
}

// H4 — Unknown routes → 404.
func TestFunctional_H4_UnknownRoute(t *testing.T) {
	ts := newFunctionalServer(t)

	for _, path := range []string{"/api/unknown", "/api/health/extra", "/"} {
		resp, err := http.Get(ts.URL + path) //nolint:noctx
		require.NoError(t, err)
		_ = resp.Body.Close()
		assert.Equal(t, http.StatusNotFound, resp.StatusCode, "path %s", path)
	}
}

// H5 — /api/health response carries Content-Type: application/json.
func TestFunctional_H5_ContentTypeJSON(t *testing.T) {
	ts := newFunctionalServer(t)

	resp, err := http.Get(ts.URL + "/api/health") //nolint:noctx
	require.NoError(t, err)
	_ = resp.Body.Close()
	assert.Contains(t, resp.Header.Get("Content-Type"), "application/json")
}
