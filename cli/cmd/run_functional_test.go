package cmd

import (
	"bytes"
	"encoding/json"
	"encoding/xml"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"sync/atomic"
	"testing"

	"github.com/spf13/cobra"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ── helpers ───────────────────────────────────────────────────────────────────

// functionalRunnerPath resolves runner/src/index.js relative to this file.
func functionalRunnerPath(t *testing.T) string {
	t.Helper()
	_, file, _, ok := runtime.Caller(0)
	require.True(t, ok)
	return filepath.Join(filepath.Dir(file), "..", "..", "runner", "src", "index.js")
}

// skipIfNoRunner skips the test when the real Node.js runner is absent.
func skipIfNoRunner(t *testing.T) string {
	t.Helper()
	p := functionalRunnerPath(t)
	if _, err := os.Stat(p); err != nil {
		t.Skipf("real runner not found at %s", p)
	}
	return p
}

// countingServer returns an HTTP handler that counts each path hit and always
// responds 200 OK with {"ok":true}. The counter is safe to read after the test.
func countingServer(hits *atomic.Int64) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hits.Add(1)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = fmt.Fprint(w, `{"ok":true,"status":200}`)
	})
}

// colJSON builds a v2.1 collection with a single GET request, optionally with
// a test script attached.
func colJSON(name, rawURL, pmTestScript string) string {
	var eventBlock string
	if pmTestScript != "" {
		eventBlock = fmt.Sprintf(
			`,"event":[{"listen":"test","script":{"type":"text/javascript","exec":[%q]}}]`,
			pmTestScript,
		)
	}
	return fmt.Sprintf(`{
  "info":{"name":%q,"schema":"https://schema.getpostman.com/json/collection/v2.1.0/collection.json"},
  "item":[{"name":"req1","request":{"method":"GET","url":%q}%s}]
}`, name, rawURL, eventBlock)
}

// colWithFoldersJSON builds a v2.1 collection with two named folders each
// containing one request.
func colWithFoldersJSON(name, urlA, urlB string) string {
	return fmt.Sprintf(`{
  "info":{"name":%q,"schema":"https://schema.getpostman.com/json/collection/v2.1.0/collection.json"},
  "item":[
    {"name":"folder-a","item":[{"name":"reqA","request":{"method":"GET","url":%q}}]},
    {"name":"folder-b","item":[{"name":"reqB","request":{"method":"GET","url":%q}}]}
  ]
}`, name, urlA, urlB)
}

// envJSON builds a minimal Postman environment JSON.
func envJSON(key, value string) string {
	return fmt.Sprintf(`{"name":"Test Env","values":[{"key":%q,"value":%q,"enabled":true}]}`, key, value)
}

// jsonReport mirrors the subset of reporter.jsonReport needed for assertions.
type jsonReport struct {
	Collection string `json:"collection"`
	Stats      struct {
		Requests struct{ Total, Failed int } `json:"requests"`
		Tests    struct{ Total, Failed int } `json:"tests"`
	} `json:"stats"`
	Iterations []struct {
		Index    int `json:"index"`
		Requests []struct {
			Name  string `json:"name"`
			Error string `json:"error,omitempty"`
			Tests []struct {
				Name   string `json:"name"`
				Passed bool   `json:"passed"`
			} `json:"tests,omitempty"`
		} `json:"requests"`
	} `json:"iterations"`
}

func readJSONReport(t *testing.T, path string) jsonReport {
	t.Helper()
	b, err := os.ReadFile(path) //nolint:gosec
	require.NoError(t, err)
	var r jsonReport
	require.NoError(t, json.Unmarshal(b, &r))
	return r
}

type xmlTestSuites struct {
	XMLName    xml.Name `xml:"testsuites"`
	Tests      int      `xml:"tests,attr"`
	Failures   int      `xml:"failures,attr"`
	TestSuites []struct {
		Name      string `xml:"name,attr"`
		Tests     int    `xml:"tests,attr"`
		Failures  int    `xml:"failures,attr"`
		TestCases []struct {
			Name    string `xml:"name,attr"`
			Failure *struct {
				Message string `xml:"message,attr"`
			} `xml:"failure"`
		} `xml:"testcase"`
	} `xml:"testsuite"`
}

func readJUnitReport(t *testing.T, path string) xmlTestSuites {
	t.Helper()
	b, err := os.ReadFile(path) //nolint:gosec
	require.NoError(t, err)
	var r xmlTestSuites
	require.NoError(t, xml.Unmarshal(b, &r))
	return r
}

// runFunc is a thin wrapper that calls runCollection and discards stdout.
func runFunc(t *testing.T, colPath string) error {
	t.Helper()
	cmd := &cobra.Command{}
	cmd.SetOut(io.Discard)
	return runCollection(cmd, []string{colPath})
}

// ── functional tests ──────────────────────────────────────────────────────────

func TestRunCollection_Functional_SingleGetRequest(t *testing.T) {
	runnerPath := skipIfNoRunner(t)
	resetFlags(t)

	var hits atomic.Int64
	srv := httptest.NewServer(countingServer(&hits))
	t.Cleanup(srv.Close)

	dir := t.TempDir()
	colPath := writeTestFile(t, dir, "col.json", colJSON("My Collection", srv.URL+"/ok", ""))
	flagRunner = runnerPath
	flagReporterJSON = filepath.Join(dir, "report.json")

	require.NoError(t, runFunc(t, colPath))
	assert.EqualValues(t, 1, hits.Load())

	rep := readJSONReport(t, flagReporterJSON)
	assert.Equal(t, "My Collection", rep.Collection)
	assert.Equal(t, 1, rep.Stats.Requests.Total)
	assert.Equal(t, 0, rep.Stats.Requests.Failed)
	require.Len(t, rep.Iterations, 1)
	require.Len(t, rep.Iterations[0].Requests, 1)
	assert.Equal(t, "req1", rep.Iterations[0].Requests[0].Name)
	assert.Empty(t, rep.Iterations[0].Requests[0].Error)
}

func TestRunCollection_Functional_PassingPmTest(t *testing.T) {
	runnerPath := skipIfNoRunner(t)
	resetFlags(t)

	srv := httptest.NewServer(countingServer(new(atomic.Int64)))
	t.Cleanup(srv.Close)

	dir := t.TempDir()
	colPath := writeTestFile(t, dir, "col.json", colJSON("C",
		srv.URL+"/ok",
		`pm.test("status is 200", () => pm.response.to.have.status(200));`,
	))
	flagRunner = runnerPath
	flagReporterJSON = filepath.Join(dir, "report.json")

	require.NoError(t, runFunc(t, colPath))

	rep := readJSONReport(t, flagReporterJSON)
	assert.Equal(t, 1, rep.Stats.Tests.Total)
	assert.Equal(t, 0, rep.Stats.Tests.Failed)
	require.Len(t, rep.Iterations[0].Requests[0].Tests, 1)
	assert.Equal(t, "status is 200", rep.Iterations[0].Requests[0].Tests[0].Name)
	assert.True(t, rep.Iterations[0].Requests[0].Tests[0].Passed)
}

func TestRunCollection_Functional_EnvVariable(t *testing.T) {
	runnerPath := skipIfNoRunner(t)
	resetFlags(t)

	srv := httptest.NewServer(countingServer(new(atomic.Int64)))
	t.Cleanup(srv.Close)

	dir := t.TempDir()
	colPath := writeTestFile(t, dir, "col.json", colJSON("C", "{{base_url}}/ok", ""))
	envPath := writeTestFile(t, dir, "env.json", envJSON("base_url", srv.URL))
	flagRunner = runnerPath
	flagEnvironment = envPath
	flagReporterJSON = filepath.Join(dir, "report.json")

	require.NoError(t, runFunc(t, colPath))

	rep := readJSONReport(t, flagReporterJSON)
	assert.Equal(t, 0, rep.Stats.Requests.Failed)
}

func TestRunCollection_Functional_EnvVarFlag(t *testing.T) {
	runnerPath := skipIfNoRunner(t)
	resetFlags(t)

	srv := httptest.NewServer(countingServer(new(atomic.Int64)))
	t.Cleanup(srv.Close)

	dir := t.TempDir()
	colPath := writeTestFile(t, dir, "col.json", colJSON("C", "{{base_url}}/ok", ""))
	flagRunner = runnerPath
	flagEnvVar = []string{"base_url=" + srv.URL}
	flagReporterJSON = filepath.Join(dir, "report.json")

	require.NoError(t, runFunc(t, colPath))

	rep := readJSONReport(t, flagReporterJSON)
	assert.Equal(t, 0, rep.Stats.Requests.Failed)
}

func TestRunCollection_Functional_GlobalVar(t *testing.T) {
	runnerPath := skipIfNoRunner(t)
	resetFlags(t)

	srv := httptest.NewServer(countingServer(new(atomic.Int64)))
	t.Cleanup(srv.Close)

	dir := t.TempDir()
	colPath := writeTestFile(t, dir, "col.json", colJSON("C", "{{server}}/ok",
		`pm.test("global var resolved", () => { pm.expect(pm.globals.get("server")).to.eql(`+fmt.Sprintf("%q", srv.URL)+`); });`,
	))
	flagRunner = runnerPath
	flagGlobalVar = []string{"server=" + srv.URL}
	flagReporterJSON = filepath.Join(dir, "report.json")

	require.NoError(t, runFunc(t, colPath))

	rep := readJSONReport(t, flagReporterJSON)
	assert.Equal(t, 0, rep.Stats.Tests.Failed)
}

func TestRunCollection_Functional_Iterations(t *testing.T) {
	runnerPath := skipIfNoRunner(t)
	resetFlags(t)

	var hits atomic.Int64
	srv := httptest.NewServer(countingServer(&hits))
	t.Cleanup(srv.Close)

	dir := t.TempDir()
	colPath := writeTestFile(t, dir, "col.json", colJSON("C", srv.URL+"/ok", ""))
	flagRunner = runnerPath
	flagIterations = 3
	flagReporterJSON = filepath.Join(dir, "report.json")

	require.NoError(t, runFunc(t, colPath))
	assert.EqualValues(t, 3, hits.Load())

	rep := readJSONReport(t, flagReporterJSON)
	assert.Len(t, rep.Iterations, 3)
	assert.Equal(t, 3, rep.Stats.Requests.Total)
}

func TestRunCollection_Functional_FolderFilter(t *testing.T) {
	runnerPath := skipIfNoRunner(t)
	resetFlags(t)

	var hitsA, hitsB atomic.Int64
	srvA := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		hitsA.Add(1)
		w.WriteHeader(http.StatusOK)
		_, _ = fmt.Fprint(w, `{}`)
	}))
	srvB := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		hitsB.Add(1)
		w.WriteHeader(http.StatusOK)
		_, _ = fmt.Fprint(w, `{}`)
	}))
	t.Cleanup(srvA.Close)
	t.Cleanup(srvB.Close)

	dir := t.TempDir()
	colPath := writeTestFile(t, dir, "col.json", colWithFoldersJSON("C", srvA.URL, srvB.URL))
	flagRunner = runnerPath
	flagFolder = "folder-a"
	flagReporterJSON = filepath.Join(dir, "report.json")

	require.NoError(t, runFunc(t, colPath))

	assert.EqualValues(t, 1, hitsA.Load(), "folder-a request must be executed")
	assert.EqualValues(t, 0, hitsB.Load(), "folder-b request must be skipped")

	rep := readJSONReport(t, flagReporterJSON)
	assert.Equal(t, 1, rep.Stats.Requests.Total)
}

func TestRunCollection_Functional_JSONReport(t *testing.T) {
	runnerPath := skipIfNoRunner(t)
	resetFlags(t)

	srv := httptest.NewServer(countingServer(new(atomic.Int64)))
	t.Cleanup(srv.Close)

	dir := t.TempDir()
	colPath := writeTestFile(t, dir, "col.json", colJSON("Report Test", srv.URL+"/ok",
		`pm.test("body has ok", () => pm.expect(pm.response.json().ok).to.be.true);`,
	))
	flagRunner = runnerPath
	flagReporterJSON = filepath.Join(dir, "report.json")

	require.NoError(t, runFunc(t, colPath))

	rep := readJSONReport(t, flagReporterJSON)
	assert.Equal(t, "Report Test", rep.Collection)
	assert.Equal(t, 1, rep.Stats.Requests.Total)
	assert.Equal(t, 0, rep.Stats.Requests.Failed)
	assert.Equal(t, 1, rep.Stats.Tests.Total)
	assert.Equal(t, 0, rep.Stats.Tests.Failed)
	assert.Equal(t, 0, rep.Iterations[0].Index)
	assert.Equal(t, "body has ok", rep.Iterations[0].Requests[0].Tests[0].Name)
}

func TestRunCollection_Functional_JUnitReport(t *testing.T) {
	runnerPath := skipIfNoRunner(t)
	resetFlags(t)

	srv := httptest.NewServer(countingServer(new(atomic.Int64)))
	t.Cleanup(srv.Close)

	dir := t.TempDir()
	colPath := writeTestFile(t, dir, "col.json", colJSON("JUnit Col", srv.URL+"/ok",
		`pm.test("passes", () => pm.response.to.have.status(200));`,
	))
	flagRunner = runnerPath
	flagReporterJUnit = filepath.Join(dir, "report.xml")

	require.NoError(t, runFunc(t, colPath))

	rep := readJUnitReport(t, flagReporterJUnit)
	assert.Equal(t, 1, rep.Tests)
	assert.Equal(t, 0, rep.Failures)
	require.Len(t, rep.TestSuites, 1)
	assert.Equal(t, "Iteration 1", rep.TestSuites[0].Name)
	require.Len(t, rep.TestSuites[0].TestCases, 1)
	assert.Equal(t, "req1 - passes", rep.TestSuites[0].TestCases[0].Name)
	assert.Nil(t, rep.TestSuites[0].TestCases[0].Failure)
}

// ── subprocess tests (testing os.Exit paths) ──────────────────────────────────

// subprocessEnv is set when the test binary is invoked as a subprocess.
const subprocessEnv = "REQLET_TEST_EXIT_SUBPROCESS"

func TestRunCollection_Functional_FailingPmTest_ExitsWithOne(t *testing.T) {
	runnerPath := skipIfNoRunner(t)

	if os.Getenv(subprocessEnv) == "1" {
		// Subprocess: run the failing collection — runCollection calls os.Exit(1).
		resetFlags(t)
		srv := httptest.NewServer(countingServer(new(atomic.Int64)))
		defer srv.Close()
		colPath := writeTestFile(t, t.TempDir(), "col.json", colJSON("C", srv.URL+"/ok",
			`pm.test("always fails", () => { throw new Error("intentional"); });`,
		))
		flagRunner = runnerPath
		cmd := &cobra.Command{}
		cmd.SetOut(io.Discard)
		_ = runCollection(cmd, []string{colPath})
		return
	}

	exe := os.Args[0]
	cmd := exec.Command(exe, //nolint:gosec // exe is os.Args[0], the test binary itself
		"-test.run=^TestRunCollection_Functional_FailingPmTest_ExitsWithOne$",
		"-test.v",
	)
	cmd.Env = append(os.Environ(), subprocessEnv+"=1")
	var out bytes.Buffer
	cmd.Stdout = &out
	cmd.Stderr = &out

	err := cmd.Run()
	var exitErr *exec.ExitError
	require.ErrorAs(t, err, &exitErr, "expected exit code 1; output:\n%s", out.String())
	assert.Equal(t, 1, exitErr.ExitCode())
}

func TestRunCollection_Functional_Bail_StopsAfterFirstFailure(t *testing.T) {
	runnerPath := skipIfNoRunner(t)

	if os.Getenv(subprocessEnv) == "2" {
		// Subprocess: bail collection — first request fails, runner must stop.
		resetFlags(t)
		dir := t.TempDir()

		var hits atomic.Int64
		srv := httptest.NewServer(countingServer(&hits))
		defer srv.Close()

		col := fmt.Sprintf(`{
  "info":{"name":"Bail","schema":"https://schema.getpostman.com/json/collection/v2.1.0/collection.json"},
  "item":[
    {"name":"r1","request":{"method":"GET","url":%q},
     "event":[{"listen":"test","script":{"type":"text/javascript","exec":[
       "pm.test(\"fail\", () => { throw new Error(\"bail\"); });"
     ]}}]},
    {"name":"r2","request":{"method":"GET","url":%q}},
    {"name":"r3","request":{"method":"GET","url":%q}}
  ]
}`, srv.URL, srv.URL, srv.URL)

		colPath := writeTestFile(t, dir, "col.json", col)
		flagRunner = runnerPath
		flagBail = true
		flagReporterJSON = filepath.Join(dir, "report.json")

		cmd := &cobra.Command{}
		cmd.SetOut(io.Discard)
		_ = runCollection(cmd, []string{colPath})
		return
	}

	exe := os.Args[0]
	cmd := exec.Command(exe, //nolint:gosec // exe is os.Args[0], the test binary itself
		"-test.run=^TestRunCollection_Functional_Bail_StopsAfterFirstFailure$",
		"-test.v",
	)
	cmd.Env = append(os.Environ(), subprocessEnv+"=2")
	var out bytes.Buffer
	cmd.Stdout = &out
	cmd.Stderr = &out

	err := cmd.Run()
	var exitErr *exec.ExitError
	require.ErrorAs(t, err, &exitErr, "expected exit code 1; output:\n%s", out.String())
	assert.Equal(t, 1, exitErr.ExitCode())
}
