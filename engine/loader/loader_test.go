package loader

import (
	"fmt"
	"os"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ── LoadCollection ───────────────────────────────────────────────────────────

func TestLoadCollection_V21(t *testing.T) {
	f, err := os.Open("../parser/testdata/collection_v21.json")
	require.NoError(t, err)
	defer func() { _ = f.Close() }()

	c, err := LoadCollection(f)
	require.NoError(t, err)

	assert.Equal(t, "Reqlet Test Collection", c.Info.Name)
	assert.Equal(t, "https://schema.getpostman.com/json/collection/v2.1.0/collection.json", c.Info.Schema)
	assert.Len(t, c.Item, 3)
}

func TestLoadCollection_V20(t *testing.T) {
	f, err := os.Open("../parser/testdata/collection_v20.json")
	require.NoError(t, err)
	defer func() { _ = f.Close() }()

	c, err := LoadCollection(f)
	require.NoError(t, err)

	// Result is always v2.1 after migration.
	assert.Equal(t, "https://schema.getpostman.com/json/collection/v2.1.0/collection.json", c.Info.Schema)
	assert.Equal(t, "Reqlet Test Collection v2.0", c.Info.Name)
	assert.Len(t, c.Item, 2)

	// Auth was migrated from object to key-value array.
	authFolder := c.Item[1]
	require.NotNil(t, authFolder.Auth)
	assert.Len(t, authFolder.Auth.Basic, 2)
	byKey := make(map[string]interface{})
	for _, p := range authFolder.Auth.Basic {
		byKey[p.Key] = p.Value
	}
	assert.Equal(t, "{{admin_user}}", byKey["username"])
}

func TestLoadCollection_V10(t *testing.T) {
	f, err := os.Open("../parser/testdata/collection_v10.json")
	require.NoError(t, err)
	defer func() { _ = f.Close() }()

	c, err := LoadCollection(f)
	require.NoError(t, err)

	assert.Equal(t, "https://schema.getpostman.com/json/collection/v2.1.0/collection.json", c.Info.Schema)
	assert.Equal(t, "Reqlet Test Collection v1.0", c.Info.Name)

	// 2 top-level requests + 1 folder = 3 items
	require.Len(t, c.Item, 3)
	assert.False(t, c.Item[0].IsFolder()) // Ping
	assert.False(t, c.Item[1].IsFolder()) // Create article
	assert.True(t, c.Item[2].IsFolder())  // Articles folder

	// Header string was parsed
	req := c.Item[0].Request
	require.NotNil(t, req)
	require.Len(t, req.Header, 1)
	assert.Equal(t, "Accept", req.Header[0].Key)
}

func TestLoadCollection_ReadError(t *testing.T) {
	_, err := LoadCollection(errReader{})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "load collection")
}

func TestLoadCollection_InvalidJSON(t *testing.T) {
	_, err := LoadCollection(strings.NewReader(`{invalid}`))
	require.Error(t, err)
}

func TestLoadCollection_UnknownSchema(t *testing.T) {
	r := strings.NewReader(`{"info":{"name":"T","schema":"https://unknown.com/s.json"},"item":[]}`)
	_, err := LoadCollection(r)
	require.Error(t, err)
}

// ── LoadEnvironment ──────────────────────────────────────────────────────────

func TestLoadEnvironment(t *testing.T) {
	f, err := os.Open("../parser/testdata/environment.json")
	require.NoError(t, err)
	defer func() { _ = f.Close() }()

	e, err := LoadEnvironment(f)
	require.NoError(t, err)

	assert.Equal(t, "Test - LOCAL", e.Name)
	assert.Len(t, e.Values, 5)
}

func TestLoadEnvironment_ReadError(t *testing.T) {
	_, err := LoadEnvironment(errReader{})
	require.Error(t, err)
}

// ── LoadData ─────────────────────────────────────────────────────────────────

func TestLoadData_CSV(t *testing.T) {
	r := strings.NewReader("name,age\nalice,30\nbob,25\n")
	rows, err := LoadData(r, ".csv")
	require.NoError(t, err)
	require.Len(t, rows, 2)
	assert.Equal(t, "alice", rows[0]["name"])
	assert.Equal(t, "30", rows[0]["age"])
	assert.Equal(t, "bob", rows[1]["name"])
}

func TestLoadData_CSV_HeaderOnly(t *testing.T) {
	rows, err := LoadData(strings.NewReader("a,b\n"), ".csv")
	require.NoError(t, err)
	assert.Nil(t, rows)
}

func TestLoadData_JSON(t *testing.T) {
	r := strings.NewReader(`[{"name":"alice","age":"30"},{"name":"bob","age":"25"}]`)
	rows, err := LoadData(r, ".json")
	require.NoError(t, err)
	require.Len(t, rows, 2)
	assert.Equal(t, "alice", rows[0]["name"])
}

func TestLoadData_JSON_NumericValues(t *testing.T) {
	r := strings.NewReader(`[{"count":42,"ratio":1.5}]`)
	rows, err := LoadData(r, ".json")
	require.NoError(t, err)
	require.Len(t, rows, 1)
	assert.Equal(t, "42", rows[0]["count"])
	assert.Equal(t, "1.5", rows[0]["ratio"])
}

func TestLoadData_UnsupportedExtension(t *testing.T) {
	_, err := LoadData(strings.NewReader(""), ".xml")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "unsupported extension")
}

func TestLoadData_CSV_CaseInsensitiveExt(t *testing.T) {
	r := strings.NewReader("x\n1\n")
	_, err := LoadData(r, ".CSV")
	require.NoError(t, err)
}

func TestLoadData_CSV_ShortRow(t *testing.T) {
	// Row with fewer columns than headers — missing columns are silently dropped.
	r := strings.NewReader("a,b,c\n1,2\n")
	rows, err := LoadData(r, ".csv")
	require.NoError(t, err)
	require.Len(t, rows, 1)
	assert.Equal(t, "1", rows[0]["a"])
	assert.Equal(t, "2", rows[0]["b"])
	_, hasC := rows[0]["c"]
	assert.False(t, hasC)
}

func TestLoadData_JSON_InvalidJSON(t *testing.T) {
	_, err := LoadData(strings.NewReader(`not json`), ".json")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "parse JSON data")
}

func TestLoadCollection_V20_ParseError(t *testing.T) {
	// v2.0 schema but missing name — parse should fail.
	r := strings.NewReader(`{"info":{"schema":"https://schema.getpostman.com/json/collection/v2.0.0/collection.json"},"item":[]}`)
	_, err := LoadCollection(r)
	require.Error(t, err)
}

func TestLoadCollection_V10_ParseError(t *testing.T) {
	// Detected as v1.0 (has "requests") but missing name.
	r := strings.NewReader(`{"id":"x","order":[],"folders":[],"requests":[]}`)
	_, err := LoadCollection(r)
	require.Error(t, err)
}

// ── Helpers ──────────────────────────────────────────────────────────────────

type errReader struct{}

func (errReader) Read(_ []byte) (int, error) {
	return 0, fmt.Errorf("read error")
}
