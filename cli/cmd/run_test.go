package cmd

import (
	"encoding/json"
	"io"
	"os"
	"path/filepath"
	"testing"

	"github.com/spf13/cobra"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func resetFlags(t *testing.T) {
	t.Helper()
	t.Cleanup(func() {
		flagEnvironment = ""
		flagGlobals = ""
		flagData = ""
		flagEnvVar = nil
		flagGlobalVar = nil
		flagRunner = ""
		flagIterations = 1
		flagDelayRequest = 0
		flagTimeout = 0
		flagTimeoutReq = 30
		flagFolder = ""
		flagBail = false
		flagInsecure = false
		flagNoColor = false
		flagVerbose = false
		flagReporterJSON = ""
		flagReporterJUnit = ""
		flagClientCert = ""
		flagClientKey = ""
		flagClientPassphrase = ""
	})
}

// ── parseKV ──────────────────────────────────────────────────────────────────

func TestParseKV_Simple(t *testing.T) {
	m, err := parseKV([]string{"key=value", "foo=bar"})
	require.NoError(t, err)
	assert.Equal(t, "value", m["key"])
	assert.Equal(t, "bar", m["foo"])
}

func TestParseKV_EmptySlice(t *testing.T) {
	m, err := parseKV(nil)
	require.NoError(t, err)
	assert.Empty(t, m)
}

func TestParseKV_ValueContainsEquals(t *testing.T) {
	m, err := parseKV([]string{"token=abc=def=="})
	require.NoError(t, err)
	assert.Equal(t, "abc=def==", m["token"])
}

func TestParseKV_EmptyValue(t *testing.T) {
	m, err := parseKV([]string{"key="})
	require.NoError(t, err)
	assert.Equal(t, "", m["key"])
}

func TestParseKV_NoEquals(t *testing.T) {
	_, err := parseKV([]string{"noequals"})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "noequals")
}

// ── helpers ───────────────────────────────────────────────────────────────────

func writeTestFile(t *testing.T, dir, name, content string) string {
	t.Helper()
	path := filepath.Join(dir, name)
	require.NoError(t, os.WriteFile(path, []byte(content), 0o600))
	return path
}

// ── loadCollection ────────────────────────────────────────────────────────────

const minimalV21 = `{
  "info": {
    "name": "Test Collection",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": []
}`

func TestLoadCollection_ValidV21(t *testing.T) {
	path := writeTestFile(t, t.TempDir(), "col.json", minimalV21)
	c, err := loadCollection(path)
	require.NoError(t, err)
	assert.Equal(t, "Test Collection", c.Info.Name)
}

func TestLoadCollection_NotFound(t *testing.T) {
	_, err := loadCollection("/nonexistent/path/collection.json")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "open collection")
}

func TestLoadCollection_InvalidJSON(t *testing.T) {
	path := writeTestFile(t, t.TempDir(), "bad.json", "not-json")
	_, err := loadCollection(path)
	require.Error(t, err)
}

// ── loadEnvironment ───────────────────────────────────────────────────────────

const minimalEnv = `{
  "name": "Dev",
  "values": [
    {"key": "base_url", "value": "http://localhost", "enabled": true}
  ]
}`

func TestLoadEnvironment_EmptyPath(t *testing.T) {
	env, err := loadEnvironment("")
	require.NoError(t, err)
	assert.Nil(t, env)
}

func TestLoadEnvironment_ValidFile(t *testing.T) {
	path := writeTestFile(t, t.TempDir(), "env.json", minimalEnv)
	e, err := loadEnvironment(path)
	require.NoError(t, err)
	require.NotNil(t, e)
	assert.Equal(t, "Dev", e.Name)
	require.Len(t, e.Values, 1)
	assert.Equal(t, "base_url", e.Values[0].Key)
}

func TestLoadEnvironment_NotFound(t *testing.T) {
	_, err := loadEnvironment("/nonexistent/env.json")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "open environment")
}

func TestLoadEnvironment_InvalidJSON(t *testing.T) {
	path := writeTestFile(t, t.TempDir(), "bad-env.json", "{invalid}")
	_, err := loadEnvironment(path)
	require.Error(t, err)
}

// ── loadData ──────────────────────────────────────────────────────────────────

func TestLoadData_EmptyPath(t *testing.T) {
	rows, err := loadData("")
	require.NoError(t, err)
	assert.Nil(t, rows)
}

func TestLoadData_CSVFile(t *testing.T) {
	path := writeTestFile(t, t.TempDir(), "data.csv", "name,env\nalice,dev\nbob,prod\n")
	rows, err := loadData(path)
	require.NoError(t, err)
	require.Len(t, rows, 2)
	assert.Equal(t, "alice", rows[0]["name"])
	assert.Equal(t, "prod", rows[1]["env"])
}

func TestLoadData_JSONFile(t *testing.T) {
	data, _ := json.Marshal([]map[string]string{{"key": "val"}, {"key": "val2"}})
	path := writeTestFile(t, t.TempDir(), "data.json", string(data))
	rows, err := loadData(path)
	require.NoError(t, err)
	require.Len(t, rows, 2)
	assert.Equal(t, "val", rows[0]["key"])
}

func TestLoadData_NotFound(t *testing.T) {
	_, err := loadData("/nonexistent/data.csv")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "open data file")
}

func TestLoadData_UnsupportedExtension(t *testing.T) {
	path := writeTestFile(t, t.TempDir(), "data.xml", "<data/>")
	_, err := loadData(path)
	require.Error(t, err)
}

// ── resolveRunner ─────────────────────────────────────────────────────────────

func TestResolveRunner_ExplicitFlag(t *testing.T) {
	path, err := resolveRunner("/custom/path/index.js")
	require.NoError(t, err)
	assert.Equal(t, "/custom/path/index.js", path)
}

func TestResolveRunner_EnvVar(t *testing.T) {
	t.Setenv("REQLET_RUNNER", "/env/path/index.js")
	path, err := resolveRunner("")
	require.NoError(t, err)
	assert.Equal(t, "/env/path/index.js", path)
}

func TestResolveRunner_FlagTakesPrecedenceOverEnv(t *testing.T) {
	t.Setenv("REQLET_RUNNER", "/env/path/index.js")
	path, err := resolveRunner("/flag/path/index.js")
	require.NoError(t, err)
	assert.Equal(t, "/flag/path/index.js", path)
}

func TestResolveRunner_NotFound(t *testing.T) {
	t.Setenv("REQLET_RUNNER", "")
	orig, err := os.Getwd()
	require.NoError(t, err)
	t.Cleanup(func() { _ = os.Chdir(orig) })
	require.NoError(t, os.Chdir(t.TempDir()))

	_, err = resolveRunner("")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "runner not found")
}

func TestResolveRunner_CWDRelativePath(t *testing.T) {
	dir := t.TempDir()
	nrPath := filepath.Join(dir, "runner", "src", "index.js")
	require.NoError(t, os.MkdirAll(filepath.Dir(nrPath), 0o750)) //nolint:gosec // test-only temp dir
	require.NoError(t, os.WriteFile(nrPath, []byte(""), 0o600))

	orig, err := os.Getwd()
	require.NoError(t, err)
	t.Cleanup(func() { _ = os.Chdir(orig) })
	require.NoError(t, os.Chdir(dir))

	t.Setenv("REQLET_RUNNER", "")

	path, err := resolveRunner("")
	require.NoError(t, err)
	assert.Equal(t, filepath.Join("runner", "src", "index.js"), path)
}

// ── runCollection ─────────────────────────────────────────────────────────────

func TestRunCollection_CollectionNotFound(t *testing.T) {
	resetFlags(t)
	t.Setenv("REQLET_RUNNER", "")

	cmd := &cobra.Command{}
	err := runCollection(cmd, []string{"/nonexistent/col.json"})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "open collection")
}

func TestRunCollection_EnvironmentNotFound(t *testing.T) {
	resetFlags(t)
	t.Setenv("REQLET_RUNNER", "")

	colPath := writeTestFile(t, t.TempDir(), "col.json", minimalV21)
	flagEnvironment = "/nonexistent/env.json"

	cmd := &cobra.Command{}
	err := runCollection(cmd, []string{colPath})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "open environment")
}

func TestRunCollection_InvalidEnvVar(t *testing.T) {
	resetFlags(t)
	t.Setenv("REQLET_RUNNER", "")

	colPath := writeTestFile(t, t.TempDir(), "col.json", minimalV21)
	flagEnvVar = []string{"noequals"}

	cmd := &cobra.Command{}
	err := runCollection(cmd, []string{colPath})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "--env-var")
}

func TestRunCollection_EnvVarWithNoLoadedEnv(t *testing.T) {
	resetFlags(t)
	t.Setenv("REQLET_RUNNER", "")

	colPath := writeTestFile(t, t.TempDir(), "col.json", minimalV21)
	flagEnvVar = []string{"TOKEN=abc"}

	cmd := &cobra.Command{}
	err := runCollection(cmd, []string{colPath})
	// fails at resolveRunner, not at env-var processing
	require.Error(t, err)
	assert.Contains(t, err.Error(), "runner not found")
}

func TestRunCollection_GlobalsFileNotFound(t *testing.T) {
	resetFlags(t)
	t.Setenv("REQLET_RUNNER", "")

	colPath := writeTestFile(t, t.TempDir(), "col.json", minimalV21)
	flagGlobals = "/nonexistent/globals.json"

	cmd := &cobra.Command{}
	err := runCollection(cmd, []string{colPath})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "globals:")
}

func TestRunCollection_InvalidGlobalVar(t *testing.T) {
	resetFlags(t)
	t.Setenv("REQLET_RUNNER", "")

	colPath := writeTestFile(t, t.TempDir(), "col.json", minimalV21)
	flagGlobalVar = []string{"noequals"}

	cmd := &cobra.Command{}
	err := runCollection(cmd, []string{colPath})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "--global-var")
}

func TestRunCollection_RunnerNotFound(t *testing.T) {
	resetFlags(t)
	t.Setenv("REQLET_RUNNER", "")

	colPath := writeTestFile(t, t.TempDir(), "col.json", minimalV21)

	orig, err := os.Getwd()
	require.NoError(t, err)
	t.Cleanup(func() { _ = os.Chdir(orig) })
	require.NoError(t, os.Chdir(t.TempDir()))

	cmd := &cobra.Command{}
	err = runCollection(cmd, []string{colPath})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "runner not found")
}

// stubRunnerJS is a minimal Node.js stub that speaks the sandbox IPC protocol.
// It responds to every "execute" message with an empty successful result.
const stubRunnerJS = `
process.stdin.setEncoding("utf8");
let buf = "";
process.stdin.on("data", (chunk) => {
  buf += chunk;
  const lines = buf.split("\n");
  buf = lines.pop();
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const m = JSON.parse(line);
      const result = { logs: [], tests: [], variables: {}, globals: {} };
      process.stdout.write(JSON.stringify({ id: m.id, result, error: null }) + "\n");
    } catch {}
  }
});
process.stdin.on("end", () => process.exit(0));
`

func writeStubRunner(t *testing.T) string {
	t.Helper()
	dir := filepath.Join(t.TempDir(), "runner", "src")
	require.NoError(t, os.MkdirAll(dir, 0o750)) //nolint:gosec
	path := filepath.Join(dir, "index.js")
	require.NoError(t, os.WriteFile(path, []byte(stubRunnerJS), 0o600))
	return path
}

func TestRunCollection_EmptyCollectionSuccess(t *testing.T) {
	resetFlags(t)

	dir := t.TempDir()
	colPath := writeTestFile(t, dir, "col.json", minimalV21)
	flagRunner = writeStubRunner(t)
	flagReporterJSON = filepath.Join(dir, "report.json")
	flagTimeout = 60

	cmd := &cobra.Command{}
	cmd.SetOut(io.Discard)
	err := runCollection(cmd, []string{colPath})
	require.NoError(t, err)
}

func TestRunCollection_WithJUnitReporter(t *testing.T) {
	resetFlags(t)

	dir := t.TempDir()
	colPath := writeTestFile(t, dir, "col.json", minimalV21)
	flagRunner = writeStubRunner(t)
	flagReporterJUnit = filepath.Join(dir, "report.xml")

	cmd := &cobra.Command{}
	cmd.SetOut(io.Discard)
	err := runCollection(cmd, []string{colPath})
	require.NoError(t, err)
}

func TestRunCollection_WithEnvVarAndGlobalVar(t *testing.T) {
	resetFlags(t)

	dir := t.TempDir()
	colPath := writeTestFile(t, dir, "col.json", minimalV21)
	envPath := writeTestFile(t, dir, "env.json", minimalEnv)
	flagRunner = writeStubRunner(t)
	flagEnvironment = envPath
	flagEnvVar = []string{"EXTRA=1"}
	flagGlobalVar = []string{"G=2"}

	cmd := &cobra.Command{}
	cmd.SetOut(io.Discard)
	err := runCollection(cmd, []string{colPath})
	require.NoError(t, err)
}
