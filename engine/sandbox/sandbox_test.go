//go:build functional

package sandbox

import (
	"context"
	"fmt"
	"io"
	"path/filepath"
	"runtime"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// runnerPath resolves the Node.js runner entry point relative to this file.
func runnerPath(t *testing.T) string {
	t.Helper()
	_, file, _, ok := runtime.Caller(0)
	require.True(t, ok)
	return filepath.Join(filepath.Dir(file), "..", "..", "runner", "src", "index.js")
}

func newRunner(t *testing.T) *nodeRunner {
	t.Helper()
	r, err := NewRunner(runnerPath(t))
	require.NoError(t, err)
	t.Cleanup(func() { _ = r.Close() })
	return r.(*nodeRunner)
}

func baseCtx() *ScriptContext {
	return &ScriptContext{
		Globals:             map[string]string{},
		Environment:         map[string]string{},
		CollectionVariables: map[string]string{},
		IterationData:       map[string]string{},
		Request: &RequestInfo{
			URL:     "https://api.example.com/users",
			Method:  "GET",
			Headers: map[string]string{},
			Body:    "",
		},
		Response: &ResponseInfo{
			Status:       "OK",
			Code:         200,
			ResponseTime: 42,
			ResponseSize: 11,
			Headers:      map[string]string{"Content-Type": "application/json"},
			Body:         `{"ok":true}`,
		},
		Info: ExecInfo{
			EventName:      "test",
			Iteration:      0,
			IterationCount: 1,
			RequestName:    "Get Users",
			RequestID:      "req-1",
		},
	}
}

// ── pm.test / pm.expect ───────────────────────────────────────────────────────

func TestExecute_PassingTest(t *testing.T) {
	r := newRunner(t)
	res, err := r.Execute(context.Background(),
		`pm.test("status is 200", () => { pm.expect(pm.response.code).to.equal(200); })`,
		"test", baseCtx())
	require.NoError(t, err)
	require.Len(t, res.Tests, 1)
	assert.True(t, res.Tests[0].Passed)
	assert.Equal(t, "status is 200", res.Tests[0].Name)
}

func TestExecute_FailingTest(t *testing.T) {
	r := newRunner(t)
	res, err := r.Execute(context.Background(),
		`pm.test("status is 404", () => { pm.expect(pm.response.code).to.equal(404); })`,
		"test", baseCtx())
	require.NoError(t, err)
	require.Len(t, res.Tests, 1)
	assert.False(t, res.Tests[0].Passed)
	assert.NotEmpty(t, res.Tests[0].Error)
}

func TestExecute_MultipleTests(t *testing.T) {
	r := newRunner(t)
	script := `
		pm.test("status ok", () => { pm.expect(pm.response.code).to.equal(200); });
		pm.test("body has ok", () => { pm.expect(pm.response.json()).to.have.property("ok"); });
		pm.test("will fail",   () => { pm.expect(1).to.equal(2); });
	`
	res, err := r.Execute(context.Background(), script, "test", baseCtx())
	require.NoError(t, err)
	require.Len(t, res.Tests, 3)
	assert.True(t, res.Tests[0].Passed)
	assert.True(t, res.Tests[1].Passed)
	assert.False(t, res.Tests[2].Passed)
}

func TestExecute_ScriptError(t *testing.T) {
	r := newRunner(t)
	res, err := r.Execute(context.Background(), `throw new Error("boom")`, "test", baseCtx())
	require.NoError(t, err) // script errors are captured as failed tests
	require.Len(t, res.Tests, 1)
	assert.False(t, res.Tests[0].Passed)
	assert.Contains(t, res.Tests[0].Error, "boom")
}

// ── Variable mutations ────────────────────────────────────────────────────────

func TestExecute_SetEnvironmentVariable(t *testing.T) {
	r := newRunner(t)
	res, err := r.Execute(context.Background(),
		`pm.environment.set("token", "abc123")`,
		"prerequest", baseCtx())
	require.NoError(t, err)
	assert.Equal(t, "abc123", res.Mutations.Environment["token"])
}

func TestExecute_SetGlobalsVariable(t *testing.T) {
	r := newRunner(t)
	res, err := r.Execute(context.Background(),
		`pm.globals.set("counter", "1")`,
		"prerequest", baseCtx())
	require.NoError(t, err)
	assert.Equal(t, "1", res.Mutations.Globals["counter"])
}

func TestExecute_UnsetVariable(t *testing.T) {
	r := newRunner(t)
	ctx := baseCtx()
	ctx.Environment["token"] = "old"
	res, err := r.Execute(context.Background(),
		`pm.environment.unset("token")`,
		"prerequest", ctx)
	require.NoError(t, err)
	_, exists := res.Mutations.Environment["token"]
	assert.False(t, exists)
}

func TestExecute_ReadVariableAcrossScopes(t *testing.T) {
	r := newRunner(t)
	ctx := baseCtx()
	ctx.Environment["base_url"] = "https://api.example.com"
	ctx.Globals["timeout"] = "30"
	res, err := r.Execute(context.Background(), `
		pm.test("reads env", () => { pm.expect(pm.variables.get("base_url")).to.equal("https://api.example.com"); });
		pm.test("reads global", () => { pm.expect(pm.variables.get("timeout")).to.equal("30"); });
	`, "test", ctx)
	require.NoError(t, err)
	assert.True(t, res.Tests[0].Passed)
	assert.True(t, res.Tests[1].Passed)
}

func TestExecute_ReadIterationData(t *testing.T) {
	r := newRunner(t)
	ctx := baseCtx()
	ctx.IterationData["username"] = "alice"
	res, err := r.Execute(context.Background(), `
		pm.test("reads data", () => { pm.expect(pm.iterationData.get("username")).to.equal("alice"); });
	`, "test", ctx)
	require.NoError(t, err)
	assert.True(t, res.Tests[0].Passed)
}

// ── Execution control ─────────────────────────────────────────────────────────

func TestExecute_SetNextRequest(t *testing.T) {
	r := newRunner(t)
	res, err := r.Execute(context.Background(),
		`pm.execution.setNextRequest("Login")`,
		"prerequest", baseCtx())
	require.NoError(t, err)
	require.NotNil(t, res.Mutations.NextRequest)
	assert.Equal(t, "Login", *res.Mutations.NextRequest)
}

func TestExecute_SetNextRequestNull(t *testing.T) {
	r := newRunner(t)
	res, err := r.Execute(context.Background(),
		`pm.execution.setNextRequest(null)`,
		"prerequest", baseCtx())
	require.NoError(t, err)
	require.NotNil(t, res.Mutations.NextRequest)
	assert.Equal(t, "", *res.Mutations.NextRequest)
}

func TestExecute_SkipRequest(t *testing.T) {
	r := newRunner(t)
	res, err := r.Execute(context.Background(),
		`pm.execution.skipRequest()`,
		"prerequest", baseCtx())
	require.NoError(t, err)
	assert.True(t, res.Mutations.SkipRequest)
}

// ── pm.info ───────────────────────────────────────────────────────────────────

func TestExecute_PmInfo(t *testing.T) {
	r := newRunner(t)
	res, err := r.Execute(context.Background(), `
		pm.test("eventName", () => { pm.expect(pm.info.eventName).to.equal("test"); });
		pm.test("requestName", () => { pm.expect(pm.info.requestName).to.equal("Get Users"); });
		pm.test("iteration", () => { pm.expect(pm.info.iteration).to.equal(0); });
	`, "test", baseCtx())
	require.NoError(t, err)
	for _, tr := range res.Tests {
		assert.True(t, tr.Passed, tr.Name+": "+tr.Error)
	}
}

// ── pm.response ───────────────────────────────────────────────────────────────

func TestExecute_PmResponseJSON(t *testing.T) {
	r := newRunner(t)
	res, err := r.Execute(context.Background(), `
		pm.test("json", () => { pm.expect(pm.response.json().ok).to.equal(true); });
	`, "test", baseCtx())
	require.NoError(t, err)
	assert.True(t, res.Tests[0].Passed)
}

func TestExecute_PmResponseText(t *testing.T) {
	r := newRunner(t)
	res, err := r.Execute(context.Background(), `
		pm.test("text", () => { pm.expect(pm.response.text()).to.include("ok"); });
	`, "test", baseCtx())
	require.NoError(t, err)
	assert.True(t, res.Tests[0].Passed)
}

// ── Concurrency ───────────────────────────────────────────────────────────────

func TestExecute_Concurrent(t *testing.T) {
	r := newRunner(t)
	const n = 10
	results := make(chan error, n)
	for i := 0; i < n; i++ {
		go func() {
			res, err := r.Execute(context.Background(),
				`pm.test("ok", () => { pm.expect(pm.response.code).to.equal(200); })`,
				"test", baseCtx())
			if err != nil {
				results <- err
				return
			}
			if !res.Tests[0].Passed {
				results <- fmt.Errorf("test failed")
				return
			}
			results <- nil
		}()
	}
	for i := 0; i < n; i++ {
		assert.NoError(t, <-results)
	}
}

// ── Context cancellation ──────────────────────────────────────────────────────

func TestExecute_ContextCancelled(t *testing.T) {
	r := newRunner(t)
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	_, err := r.Execute(ctx, `pm.test("x", () => {})`, "test", baseCtx())
	assert.ErrorIs(t, err, context.Canceled)
}

// ── Error paths ───────────────────────────────────────────────────────────────

func TestExecute_NodeDies(t *testing.T) {
	// Node starts but exits immediately because the script path does not exist.
	r, err := NewRunner("/nonexistent/index.js")
	require.NoError(t, err)
	defer func() { _ = r.Close() }()

	// Wait for readLoop to detect node exited.
	<-r.(*nodeRunner).done

	// Execute must return an error (either write error or "node process exited").
	_, err = r.Execute(context.Background(), `pm.test("x", () => {})`, "test", baseCtx())
	require.Error(t, err)
}

func TestExecute_WriteError(t *testing.T) {
	r := newRunner(t)
	// Close stdin so the next write fails.
	_ = r.stdin.Close()

	_, err := r.Execute(context.Background(), `pm.test("x", () => {})`, "test", baseCtx())
	require.Error(t, err)
}

func TestExecute_DoneWhileWaiting(t *testing.T) {
	// Simulate: write succeeds but node never responds and the process exits.
	stdinR, stdinW := io.Pipe()
	_, stdoutW := io.Pipe()

	r := &nodeRunner{
		stdin:    stdinW,
		inflight: make(map[string]chan response),
		done:     make(chan struct{}),
	}
	// readLoop on an immediately-closed stdout → closes r.done right away.
	go r.readLoop(stdinR)
	_ = stdoutW.Close() // unused but satisfies the linter

	// Drain stdin so the write in Execute doesn't block.
	go func() {
		_, _ = io.Copy(io.Discard, stdinR)
	}()

	// Close done before Execute reads the response.
	close(r.done)

	_, err := r.Execute(context.Background(), `pm.test("x", () => {})`, "test", baseCtx())
	require.Error(t, err)
	assert.Contains(t, err.Error(), "node process exited")
}

// ── NewRunner error paths ─────────────────────────────────────────────────────

func TestNewRunner_StartError(t *testing.T) {
	// A path whose second-level parent does not exist forces cmd.Dir to a
	// non-existent directory, which causes cmd.Start() to fail with a chdir error.
	_, err := NewRunner("/truly_nonexistent_8x7y3z/src/index.js")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "sandbox: start node")
}

func TestReadLoop_InvalidJSON(t *testing.T) {
	pr, pw := io.Pipe()
	r := &nodeRunner{
		inflight: make(map[string]chan response),
		done:     make(chan struct{}),
	}
	go r.readLoop(pr)

	// Invalid JSON must be silently skipped; runner must not crash.
	_, _ = fmt.Fprintln(pw, "not-valid-json")
	// Unknown ID must be silently skipped.
	_, _ = fmt.Fprintln(pw, `{"id":"999","result":{"tests":[],"mutations":{}},"error":""}`)
	_ = pw.Close()
	<-r.done
}

func TestReadLoop_ErrorResponse(t *testing.T) {
	pr, pw := io.Pipe()
	r := &nodeRunner{
		inflight: make(map[string]chan response),
		done:     make(chan struct{}),
	}
	ch := make(chan response, 1)
	r.mu.Lock()
	r.inflight["42"] = ch
	r.mu.Unlock()

	go r.readLoop(pr)
	_, _ = fmt.Fprintln(pw, `{"id":"42","result":null,"error":"script crashed"}`)
	_ = pw.Close()

	resp := <-ch
	require.Error(t, resp.err)
	assert.Contains(t, resp.err.Error(), "script crashed")
}

// ── Library availability ──────────────────────────────────────────────────────

func TestExecute_LodashAvailable(t *testing.T) {
	r := newRunner(t)
	res, err := r.Execute(context.Background(), `
		pm.test("lodash", () => { pm.expect(_.isArray([])).to.be.true; });
	`, "test", baseCtx())
	require.NoError(t, err)
	assert.True(t, res.Tests[0].Passed, res.Tests[0].Error)
}

func TestExecute_MomentAvailable(t *testing.T) {
	r := newRunner(t)
	res, err := r.Execute(context.Background(), `
		pm.test("moment", () => { pm.expect(moment().isValid()).to.be.true; });
	`, "test", baseCtx())
	require.NoError(t, err)
	assert.True(t, res.Tests[0].Passed, res.Tests[0].Error)
}

func TestExecute_AjvAvailable(t *testing.T) {
	r := newRunner(t)
	res, err := r.Execute(context.Background(), `
		const ajv = new Ajv();
		const validate = ajv.compile({ type: "object" });
		pm.test("ajv", () => { pm.expect(validate({})).to.be.true; });
	`, "test", baseCtx())
	require.NoError(t, err)
	assert.True(t, res.Tests[0].Passed, res.Tests[0].Error)
}

func TestExecute_AtobBtoa(t *testing.T) {
	r := newRunner(t)
	res, err := r.Execute(context.Background(), `
		const encoded = btoa("hello");
		const decoded = atob(encoded);
		pm.test("btoa/atob", () => { pm.expect(decoded).to.equal("hello"); });
	`, "test", baseCtx())
	require.NoError(t, err)
	assert.True(t, res.Tests[0].Passed, res.Tests[0].Error)
}
