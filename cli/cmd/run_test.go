package cmd

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

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

// ── resolveNodeRunner ─────────────────────────────────────────────────────────

func TestResolveNodeRunner_ExplicitFlag(t *testing.T) {
	path, err := resolveNodeRunner("/custom/path/index.js")
	require.NoError(t, err)
	assert.Equal(t, "/custom/path/index.js", path)
}

func TestResolveNodeRunner_EnvVar(t *testing.T) {
	t.Setenv("REQLET_NODE_RUNNER", "/env/path/index.js")
	path, err := resolveNodeRunner("")
	require.NoError(t, err)
	assert.Equal(t, "/env/path/index.js", path)
}

func TestResolveNodeRunner_FlagTakesPrecedenceOverEnv(t *testing.T) {
	t.Setenv("REQLET_NODE_RUNNER", "/env/path/index.js")
	path, err := resolveNodeRunner("/flag/path/index.js")
	require.NoError(t, err)
	assert.Equal(t, "/flag/path/index.js", path)
}

func TestResolveNodeRunner_NotFound(t *testing.T) {
	t.Setenv("REQLET_NODE_RUNNER", "")
	orig, err := os.Getwd()
	require.NoError(t, err)
	t.Cleanup(func() { _ = os.Chdir(orig) })
	require.NoError(t, os.Chdir(t.TempDir()))

	_, err = resolveNodeRunner("")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "node runner not found")
}

func TestResolveNodeRunner_CWDRelativePath(t *testing.T) {
	dir := t.TempDir()
	nrPath := filepath.Join(dir, "node-runner", "src", "index.js")
	require.NoError(t, os.MkdirAll(filepath.Dir(nrPath), 0o750)) //nolint:gosec // test-only temp dir
	require.NoError(t, os.WriteFile(nrPath, []byte(""), 0o600))

	orig, err := os.Getwd()
	require.NoError(t, err)
	t.Cleanup(func() { _ = os.Chdir(orig) })
	require.NoError(t, os.Chdir(dir))

	t.Setenv("REQLET_NODE_RUNNER", "")

	path, err := resolveNodeRunner("")
	require.NoError(t, err)
	assert.Equal(t, filepath.Join("node-runner", "src", "index.js"), path)
}
