package runner

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	enginehttp "github.com/guillaumedelre/reqlet/engine/http"
	"github.com/guillaumedelre/reqlet/engine/parser"
	"github.com/guillaumedelre/reqlet/engine/sandbox"
)

// ── mock sandbox ──────────────────────────────────────────────────────────────

type mockSandbox struct {
	mu      sync.Mutex
	calls   []mockCall
	results []mockQueueItem
}

type mockCall struct {
	script string
	event  string
	ctx    *sandbox.ScriptContext
}

type mockQueueItem struct {
	result *sandbox.ScriptResult
	err    error
}

// push queues successful results; they are dequeued in order on each Execute call.
func (m *mockSandbox) push(results ...sandbox.ScriptResult) {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, r := range results {
		r2 := r
		m.results = append(m.results, mockQueueItem{result: &r2})
	}
}

// pushErr queues an error to be returned by the next Execute call.
func (m *mockSandbox) pushErr(err error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.results = append(m.results, mockQueueItem{err: err})
}

func (m *mockSandbox) Execute(_ context.Context, script, event string, sctx *sandbox.ScriptContext) (*sandbox.ScriptResult, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.calls = append(m.calls, mockCall{script: script, event: event, ctx: sctx})
	if len(m.results) == 0 {
		return passResult(sctx), nil
	}
	item := m.results[0]
	m.results = m.results[1:]
	if item.err != nil {
		return nil, item.err
	}
	return item.result, nil
}

func (m *mockSandbox) Close() error { return nil }

// passResult returns a passing ScriptResult that mirrors the input scope state.
func passResult(sctx *sandbox.ScriptContext) *sandbox.ScriptResult {
	return &sandbox.ScriptResult{
		Mutations: sandbox.Mutations{
			Globals:             clone(sctx.Globals),
			Environment:         clone(sctx.Environment),
			CollectionVariables: clone(sctx.CollectionVariables),
		},
	}
}

func clone(m map[string]string) map[string]string {
	out := make(map[string]string, len(m))
	for k, v := range m {
		out[k] = v
	}
	return out
}

// ── helpers ───────────────────────────────────────────────────────────────────

func newTestRunner(t *testing.T, handler http.Handler) (*Runner, *httptest.Server, *mockSandbox) {
	t.Helper()
	srv := httptest.NewServer(handler)
	t.Cleanup(srv.Close)
	client, err := enginehttp.NewClient(enginehttp.DefaultOptions())
	require.NoError(t, err)
	sb := &mockSandbox{}
	return New(client, sb), srv, sb
}

func simpleCollection(name string, requests ...parser.Item) *parser.Collection {
	return &parser.Collection{
		Info: parser.Info{Name: name, Schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"},
		Item: requests,
	}
}

func getRequest(t *testing.T, srv *httptest.Server, name string) parser.Item {
	t.Helper()
	return parser.Item{
		Name: name,
		Request: &parser.Request{
			Method: "GET",
			URL:    parser.URL{Raw: srv.URL + "/ok"},
		},
	}
}

func getRequestWithEvent(t *testing.T, srv *httptest.Server, name, eventType, script string) parser.Item {
	t.Helper()
	item := getRequest(t, srv, name)
	item.Event = []parser.Event{event(eventType, script)}
	return item
}

func event(listen, script string) parser.Event {
	return parser.Event{
		Listen: listen,
		Script: parser.Script{Type: "text/javascript", Exec: []string{script}},
	}
}

func okServer() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]bool{"ok": true})
	})
}

// ── basic execution ───────────────────────────────────────────────────────────

func TestRun_SingleRequest(t *testing.T) {
	r, srv, _ := newTestRunner(t, okServer())
	col := simpleCollection("c", getRequest(t, srv, "req1"))
	res, err := r.Run(context.Background(), col, nil, Options{})
	require.NoError(t, err)
	require.Len(t, res.Iterations, 1)
	require.Len(t, res.Iterations[0].Requests, 1)
	assert.Equal(t, "req1", res.Iterations[0].Requests[0].Name)
	assert.Nil(t, res.Iterations[0].Requests[0].Error)
}

func TestRun_MultipleRequests(t *testing.T) {
	r, srv, _ := newTestRunner(t, okServer())
	col := simpleCollection(
		"c",
		getRequest(t, srv, "r1"),
		getRequest(t, srv, "r2"),
		getRequest(t, srv, "r3"),
	)
	res, err := r.Run(context.Background(), col, nil, Options{})
	require.NoError(t, err)
	require.Len(t, res.Iterations[0].Requests, 3)
	assert.Equal(t, "r1", res.Iterations[0].Requests[0].Name)
	assert.Equal(t, "r3", res.Iterations[0].Requests[2].Name)
}

func TestRun_RequestsInsideFolder(t *testing.T) {
	r, srv, _ := newTestRunner(t, okServer())
	col := simpleCollection("c", parser.Item{
		Name: "folder",
		Item: []parser.Item{
			getRequest(t, srv, "nested"),
		},
	})
	res, err := r.Run(context.Background(), col, nil, Options{})
	require.NoError(t, err)
	require.Len(t, res.Iterations[0].Requests, 1)
	assert.Equal(t, "nested", res.Iterations[0].Requests[0].Name)
}

// ── script execution order ────────────────────────────────────────────────────

func TestRun_ScriptOrder(t *testing.T) {
	r, srv, sb := newTestRunner(t, okServer())

	col := simpleCollection("c")
	col.Event = []parser.Event{event("prerequest", "col-pre"), event("test", "col-test")}

	folder := parser.Item{
		Name:  "folder",
		Event: []parser.Event{event("prerequest", "folder-pre"), event("test", "folder-test")},
		Item: []parser.Item{{
			Name:  "req",
			Event: []parser.Event{event("prerequest", "req-pre"), event("test", "req-test")},
			Request: &parser.Request{
				Method: "GET",
				URL:    parser.URL{Raw: srv.URL + "/ok"},
			},
		}},
	}
	col.Item = []parser.Item{folder}

	_, err := r.Run(context.Background(), col, nil, Options{})
	require.NoError(t, err)

	scripts := make([]string, len(sb.calls))
	for i, c := range sb.calls {
		scripts[i] = c.script
	}
	assert.Equal(t, []string{"col-pre", "folder-pre", "req-pre", "col-test", "folder-test", "req-test"}, scripts)
}

// ── iterations ────────────────────────────────────────────────────────────────

func TestRun_MultipleIterations(t *testing.T) {
	r, srv, _ := newTestRunner(t, okServer())
	col := simpleCollection("c", getRequest(t, srv, "r1"))
	res, err := r.Run(context.Background(), col, nil, Options{Iterations: 3})
	require.NoError(t, err)
	require.Len(t, res.Iterations, 3)
	for i, it := range res.Iterations {
		assert.Equal(t, i, it.Index)
		require.Len(t, it.Requests, 1)
	}
}

// ── data file injection ───────────────────────────────────────────────────────

func TestRun_DataInjection(t *testing.T) {
	r, srv, sb := newTestRunner(t, okServer())
	col := simpleCollection("c")
	col.Item = []parser.Item{{
		Name:  "req",
		Event: []parser.Event{event("test", "check")},
		Request: &parser.Request{
			Method: "GET",
			URL:    parser.URL{Raw: srv.URL + "/ok"},
		},
	}}

	_, err := r.Run(context.Background(), col, nil, Options{
		Iterations: 2,
		Data: []map[string]string{
			{"user": "alice"},
			{"user": "bob"},
		},
	})
	require.NoError(t, err)
	require.Len(t, sb.calls, 2)
	assert.Equal(t, "alice", sb.calls[0].ctx.IterationData["user"])
	assert.Equal(t, "bob", sb.calls[1].ctx.IterationData["user"])
}

// ── setNextRequest ────────────────────────────────────────────────────────────

func TestRun_SetNextRequest_Jump(t *testing.T) {
	r, srv, sb := newTestRunner(t, okServer())
	col := simpleCollection(
		"c",
		getRequest(t, srv, "r1"),
		getRequest(t, srv, "r2"),
		getRequest(t, srv, "r3"),
	)

	// r1 has a test script; it jumps to r3, skipping r2
	col.Item[0] = getRequestWithEvent(t, srv, "r1", "test", "jump")
	name := "r3"
	sb.push(sandbox.ScriptResult{
		Mutations: sandbox.Mutations{
			Globals:             map[string]string{},
			Environment:         map[string]string{},
			CollectionVariables: map[string]string{},
			NextRequest:         &name,
		},
	})

	res, err := r.Run(context.Background(), col, nil, Options{})
	require.NoError(t, err)
	require.Len(t, res.Iterations[0].Requests, 2)
	assert.Equal(t, "r1", res.Iterations[0].Requests[0].Name)
	assert.Equal(t, "r3", res.Iterations[0].Requests[1].Name)
}

func TestRun_SetNextRequest_Stop(t *testing.T) {
	r, srv, sb := newTestRunner(t, okServer())
	col := simpleCollection(
		"c",
		getRequest(t, srv, "r1"),
		getRequest(t, srv, "r2"),
	)

	// r1 has a test script; it stops execution
	col.Item[0] = getRequestWithEvent(t, srv, "r1", "test", "stop")
	stop := ""
	sb.push(sandbox.ScriptResult{
		Mutations: sandbox.Mutations{
			Globals:             map[string]string{},
			Environment:         map[string]string{},
			CollectionVariables: map[string]string{},
			NextRequest:         &stop,
		},
	})

	res, err := r.Run(context.Background(), col, nil, Options{})
	require.NoError(t, err)
	require.Len(t, res.Iterations[0].Requests, 1)
	assert.Equal(t, "r1", res.Iterations[0].Requests[0].Name)
}

// ── skipRequest ───────────────────────────────────────────────────────────────

func TestRun_SkipRequest(t *testing.T) {
	r, srv, sb := newTestRunner(t, okServer())
	col := simpleCollection(
		"c",
		getRequest(t, srv, "r1"),
		getRequest(t, srv, "r2"),
	)

	// r1 has a pre-request script that skips the request
	col.Item[0] = getRequestWithEvent(t, srv, "r1", "prerequest", "skip")
	sb.push(sandbox.ScriptResult{
		Mutations: sandbox.Mutations{
			Globals:             map[string]string{},
			Environment:         map[string]string{},
			CollectionVariables: map[string]string{},
			SkipRequest:         true,
		},
	})

	res, err := r.Run(context.Background(), col, nil, Options{})
	require.NoError(t, err)
	require.Len(t, res.Iterations[0].Requests, 2)
	assert.True(t, res.Iterations[0].Requests[0].Skipped)
	assert.False(t, res.Iterations[0].Requests[1].Skipped)
}

// ── bail ──────────────────────────────────────────────────────────────────────

func TestRun_Bail(t *testing.T) {
	r, srv, sb := newTestRunner(t, okServer())
	col := simpleCollection(
		"c",
		getRequest(t, srv, "r1"),
		getRequest(t, srv, "r2"),
		getRequest(t, srv, "r3"),
	)

	// r1 has a test script that fails
	col.Item[0] = getRequestWithEvent(t, srv, "r1", "test", "failing")
	sb.push(sandbox.ScriptResult{
		Tests: []sandbox.TestResult{{Name: "t1", Passed: false, Error: "boom"}},
		Mutations: sandbox.Mutations{
			Globals:             map[string]string{},
			Environment:         map[string]string{},
			CollectionVariables: map[string]string{},
		},
	})

	res, err := r.Run(context.Background(), col, nil, Options{Bail: true})
	require.NoError(t, err)
	require.Len(t, res.Iterations[0].Requests, 1)
	assert.False(t, res.Iterations[0].Passed())
}

// ── variable mutations ────────────────────────────────────────────────────────

func TestRun_VariableMutationPropagates(t *testing.T) {
	r, srv, sb := newTestRunner(t, okServer())
	col := simpleCollection(
		"c",
		getRequest(t, srv, "r1"),
		getRequest(t, srv, "r2"),
	)

	// r1 has a pre-request script that sets a token; r2 also has one so we can inspect its context
	col.Item[0] = getRequestWithEvent(t, srv, "r1", "prerequest", "set-token")
	col.Item[1] = getRequestWithEvent(t, srv, "r2", "prerequest", "read-token")

	sb.push(sandbox.ScriptResult{
		Mutations: sandbox.Mutations{
			Globals:             map[string]string{},
			Environment:         map[string]string{"token": "abc123"},
			CollectionVariables: map[string]string{},
		},
	})

	_, err := r.Run(context.Background(), col, nil, Options{})
	require.NoError(t, err)

	// r2's pre-request script should see token in its context
	require.Len(t, sb.calls, 2)
	assert.Equal(t, "abc123", sb.calls[1].ctx.Environment["token"])
}

// ── folder filter ─────────────────────────────────────────────────────────────

func TestRun_FolderFilter(t *testing.T) {
	r, srv, _ := newTestRunner(t, okServer())
	col := simpleCollection(
		"c",
		parser.Item{
			Name: "folderA",
			Item: []parser.Item{getRequest(t, srv, "inA")},
		},
		parser.Item{
			Name: "folderB",
			Item: []parser.Item{getRequest(t, srv, "inB")},
		},
	)

	res, err := r.Run(context.Background(), col, nil, Options{Folder: "folderA"})
	require.NoError(t, err)
	require.Len(t, res.Iterations[0].Requests, 1)
	assert.Equal(t, "inA", res.Iterations[0].Requests[0].Name)
}

// ── environment variables ─────────────────────────────────────────────────────

func TestRun_EnvironmentVariables(t *testing.T) {
	var capturedURL string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		capturedURL = "http://" + r.Host + r.URL.Path
		w.WriteHeader(http.StatusOK)
	}))
	t.Cleanup(srv.Close)

	client, err := enginehttp.NewClient(enginehttp.DefaultOptions())
	require.NoError(t, err)
	sb := &mockSandbox{}
	runner := New(client, sb)

	host := srv.Listener.Addr().String()
	env := &parser.Environment{
		Values: []parser.EnvironmentValue{
			{Key: "host", Value: host, Enabled: true},
		},
	}
	col := simpleCollection("c", parser.Item{
		Name: "r1",
		Request: &parser.Request{
			Method: "GET",
			URL:    parser.URL{Raw: "http://{{host}}/path"},
		},
	})

	_, err = runner.Run(context.Background(), col, env, Options{})
	require.NoError(t, err)
	assert.Equal(t, "http://"+host+"/path", capturedURL)
}

// ── infinite loop protection ──────────────────────────────────────────────────

func TestRun_InfiniteLoopProtection(t *testing.T) {
	r, srv, sb := newTestRunner(t, okServer())
	col := simpleCollection("c", getRequest(t, srv, "r1"))

	// r1 has a test script that always jumps back to itself
	col.Item[0] = getRequestWithEvent(t, srv, "r1", "test", "loop")
	for range maxRequestsPerIteration + 1 {
		name := "r1"
		sb.push(sandbox.ScriptResult{
			Mutations: sandbox.Mutations{
				Globals:             map[string]string{},
				Environment:         map[string]string{},
				CollectionVariables: map[string]string{},
				NextRequest:         &name,
			},
		})
	}

	_, err := r.Run(context.Background(), col, nil, Options{})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "exceeded")
}

// ── context cancellation ──────────────────────────────────────────────────────

func TestRun_ContextCancelled(t *testing.T) {
	r, srv, _ := newTestRunner(t, okServer())
	col := simpleCollection(
		"c",
		getRequest(t, srv, "r1"),
		getRequest(t, srv, "r2"),
	)

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	_, err := r.Run(ctx, col, nil, Options{})
	// Either the HTTP request or the context check fails
	assert.Error(t, err)
}

// ── flatten ───────────────────────────────────────────────────────────────────

func TestFlatten(t *testing.T) {
	items := []parser.Item{
		{Name: "r1", Request: &parser.Request{}},
		{Name: "folder", Item: []parser.Item{
			{Name: "r2", Request: &parser.Request{}},
			{Name: "subfolder", Item: []parser.Item{
				{Name: "r3", Request: &parser.Request{}},
			}},
		}},
		{Name: "r4", Request: &parser.Request{}},
	}

	flat := flatten(items, nil)
	require.Len(t, flat, 4)
	assert.Equal(t, "r1", flat[0].name)
	assert.Equal(t, "r2", flat[1].name)
	assert.Equal(t, "r3", flat[2].name)
	assert.Equal(t, "r4", flat[3].name)

	assert.Empty(t, flat[0].folders)
	assert.Equal(t, "folder", flat[1].folders[0].Name)
	assert.Equal(t, "folder", flat[2].folders[0].Name)
	assert.Equal(t, "subfolder", flat[2].folders[1].Name)
}

// ── SaveResponse ──────────────────────────────────────────────────────────────

func TestRun_SaveResponse(t *testing.T) {
	r, srv, _ := newTestRunner(t, okServer())
	col := simpleCollection("c", getRequest(t, srv, "r1"))

	res, err := r.Run(context.Background(), col, nil, Options{SaveResponse: true})
	require.NoError(t, err)
	require.NotNil(t, res.Iterations[0].Requests[0].Response)
	assert.Equal(t, 200, res.Iterations[0].Requests[0].Response.StatusCode)
}

func TestRun_NoSaveResponse(t *testing.T) {
	r, srv, _ := newTestRunner(t, okServer())
	col := simpleCollection("c", getRequest(t, srv, "r1"))

	res, err := r.Run(context.Background(), col, nil, Options{})
	require.NoError(t, err)
	assert.Nil(t, res.Iterations[0].Requests[0].Response)
}

// ── collection variables ──────────────────────────────────────────────────────

func TestRun_CollectionVariables(t *testing.T) {
	var capturedPath string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		capturedPath = r.URL.Path
		w.WriteHeader(http.StatusOK)
	}))
	t.Cleanup(srv.Close)
	client, err := enginehttp.NewClient(enginehttp.DefaultOptions())
	require.NoError(t, err)
	runner := New(client, &mockSandbox{})

	col := simpleCollection("c", parser.Item{
		Name: "r1",
		Request: &parser.Request{
			Method: "GET",
			URL:    parser.URL{Raw: srv.URL + "/{{version}}/users"},
		},
	})
	col.Variable = []parser.Variable{
		{Key: "version", Value: "v1"},
	}

	_, err = runner.Run(context.Background(), col, nil, Options{})
	require.NoError(t, err)
	assert.Equal(t, "/v1/users", capturedPath)
}

// ── setNextRequest unknown target ─────────────────────────────────────────────

func TestRun_SetNextRequest_UnknownTarget(t *testing.T) {
	r, srv, sb := newTestRunner(t, okServer())
	col := simpleCollection(
		"c",
		getRequestWithEvent(t, srv, "r1", "test", "jump-unknown"),
		getRequest(t, srv, "r2"),
	)

	unknown := "nonexistent"
	sb.push(sandbox.ScriptResult{
		Mutations: sandbox.Mutations{
			Globals:             map[string]string{},
			Environment:         map[string]string{},
			CollectionVariables: map[string]string{},
			NextRequest:         &unknown,
		},
	})

	res, err := r.Run(context.Background(), col, nil, Options{})
	require.NoError(t, err)
	// Unknown target → continue normally to r2
	require.Len(t, res.Iterations[0].Requests, 2)
	assert.Equal(t, "r2", res.Iterations[0].Requests[1].Name)
}

// ── raw body in script context ────────────────────────────────────────────────

func TestRun_RawBodyInScriptContext(t *testing.T) {
	r, srv, sb := newTestRunner(t, okServer())
	col := simpleCollection("c", parser.Item{
		Name:  "post",
		Event: []parser.Event{event("test", "check-body")},
		Request: &parser.Request{
			Method: "POST",
			URL:    parser.URL{Raw: srv.URL + "/ok"},
			Body:   &parser.Body{Mode: parser.BodyModeRaw, Raw: `{"hello":"world"}`},
		},
	})

	_, err := r.Run(context.Background(), col, nil, Options{})
	require.NoError(t, err)
	require.Len(t, sb.calls, 1)
	require.NotNil(t, sb.calls[0].ctx.Request)
	assert.Equal(t, `{"hello":"world"}`, sb.calls[0].ctx.Request.Body)
}

// ── collection-level auth ─────────────────────────────────────────────────────

func TestRun_CollectionAuth(t *testing.T) {
	var capturedAuth string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		capturedAuth = r.Header.Get("Authorization")
		w.WriteHeader(http.StatusOK)
	}))
	t.Cleanup(srv.Close)
	client, err := enginehttp.NewClient(enginehttp.DefaultOptions())
	require.NoError(t, err)
	runner := New(client, &mockSandbox{})

	col := simpleCollection("c", parser.Item{
		Name: "r1",
		Request: &parser.Request{
			Method: "GET",
			URL:    parser.URL{Raw: srv.URL + "/ok"},
		},
	})
	col.Auth = &parser.Auth{
		Type:   parser.AuthTypeBearer,
		Bearer: []parser.AuthParam{{Key: "token", Value: "my-secret"}},
	}

	_, err = runner.Run(context.Background(), col, nil, Options{})
	require.NoError(t, err)
	assert.Equal(t, "Bearer my-secret", capturedAuth)
}

// ── sandbox errors ────────────────────────────────────────────────────────────

func TestRun_SandboxPreRequestError(t *testing.T) {
	r, srv, sb := newTestRunner(t, okServer())
	col := simpleCollection("c", getRequestWithEvent(t, srv, "r1", "prerequest", "boom"))
	sb.pushErr(fmt.Errorf("ipc failure"))

	res, err := r.Run(context.Background(), col, nil, Options{})
	require.NoError(t, err) // sandbox errors are captured in RequestResult.Error
	require.Len(t, res.Iterations[0].Requests, 1)
	require.Error(t, res.Iterations[0].Requests[0].Error)
	assert.Contains(t, res.Iterations[0].Requests[0].Error.Error(), "ipc failure")
}

func TestRun_SandboxTestScriptError(t *testing.T) {
	r, srv, sb := newTestRunner(t, okServer())
	col := simpleCollection("c", getRequestWithEvent(t, srv, "r1", "test", "boom"))
	sb.pushErr(fmt.Errorf("ipc failure"))

	res, err := r.Run(context.Background(), col, nil, Options{})
	require.NoError(t, err)
	require.Len(t, res.Iterations[0].Requests, 1)
	require.Error(t, res.Iterations[0].Requests[0].Error)
	assert.Contains(t, res.Iterations[0].Requests[0].Error.Error(), "ipc failure")
}

// ── RunResult.Passed ──────────────────────────────────────────────────────────

func TestRunResult_Passed(t *testing.T) {
	passing := RunResult{Iterations: []IterationResult{
		{Requests: []RequestResult{{Name: "r1", Tests: []sandbox.TestResult{{Passed: true}}}}},
	}}
	assert.True(t, passing.Passed())

	failing := RunResult{Iterations: []IterationResult{
		{Requests: []RequestResult{{Name: "r1", Tests: []sandbox.TestResult{{Passed: false}}}}},
	}}
	assert.False(t, failing.Passed())

	skipped := RunResult{Iterations: []IterationResult{
		{Requests: []RequestResult{{Name: "r1", Skipped: true}}},
	}}
	assert.True(t, skipped.Passed())

	withErr := RunResult{Iterations: []IterationResult{
		{Requests: []RequestResult{{Name: "r1", Error: fmt.Errorf("oops")}}},
	}}
	assert.False(t, withErr.Passed())
}
