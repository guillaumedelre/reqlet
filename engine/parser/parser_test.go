package parser

import (
	"fmt"
	"os"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ── ParseCollection ──────────────────────────────────────────────────────────

func TestParseCollection_V21(t *testing.T) {
	f, err := os.Open("testdata/collection_v21.json")
	require.NoError(t, err)
	defer func() { _ = f.Close() }()

	c, err := ParseCollection(f)
	require.NoError(t, err)

	assert.Equal(t, "Reqlet Test Collection", c.Info.Name)
	assert.Equal(t, schemaV21, c.Info.Schema)
	assert.Len(t, c.Item, 3)
	assert.Len(t, c.Variable, 1)
	assert.Equal(t, "base_url", c.Variable[0].Key)
	assert.Len(t, c.Event, 2)
}

func TestParseCollection_CollectionLevelEvents(t *testing.T) {
	f, err := os.Open("testdata/collection_v21.json")
	require.NoError(t, err)
	defer func() { _ = f.Close() }()

	c, err := ParseCollection(f)
	require.NoError(t, err)

	require.Len(t, c.Event, 2)
	assert.Equal(t, "prerequest", c.Event[0].Listen)
	assert.Equal(t, "test", c.Event[1].Listen)
	assert.Contains(t, ScriptBody(c.Event[0].Script), "pm.variables.set")
}

func TestParseCollection_FolderStructure(t *testing.T) {
	f, err := os.Open("testdata/collection_v21.json")
	require.NoError(t, err)
	defer func() { _ = f.Close() }()

	c, err := ParseCollection(f)
	require.NoError(t, err)

	articles := c.Item[0]
	assert.True(t, articles.IsFolder())
	assert.Equal(t, "Articles", articles.Name)
	assert.Len(t, articles.Item, 2)

	authFolder := c.Item[1]
	assert.True(t, authFolder.IsFolder())
	require.NotNil(t, authFolder.Auth)
	assert.Equal(t, AuthTypeBasic, authFolder.Auth.Type)
	assert.Len(t, authFolder.Auth.Basic, 2)
}

func TestParseCollection_GetRequest(t *testing.T) {
	f, err := os.Open("testdata/collection_v21.json")
	require.NoError(t, err)
	defer func() { _ = f.Close() }()

	c, err := ParseCollection(f)
	require.NoError(t, err)

	req := c.Item[0].Item[0]
	assert.False(t, req.IsFolder())
	assert.Equal(t, "Get article by id", req.Name)
	require.NotNil(t, req.Request)
	assert.Equal(t, "GET", req.Request.Method)
	assert.Equal(t, "{{base_url}}/articles/article-slug-001", req.Request.URL.Raw)
	assert.Len(t, req.Request.Header, 2)
	assert.Equal(t, "Accept", req.Request.Header[0].Key)
}

func TestParseCollection_QueryParams(t *testing.T) {
	f, err := os.Open("testdata/collection_v21.json")
	require.NoError(t, err)
	defer func() { _ = f.Close() }()

	c, err := ParseCollection(f)
	require.NoError(t, err)

	req := c.Item[0].Item[1]
	require.NotNil(t, req.Request)
	assert.Len(t, req.Request.URL.Query, 3)
	assert.Equal(t, "lang", req.Request.URL.Query[0].Key)
	assert.Equal(t, "FR", req.Request.URL.Query[0].Value)
}

func TestParseCollection_RequestScripts(t *testing.T) {
	f, err := os.Open("testdata/collection_v21.json")
	require.NoError(t, err)
	defer func() { _ = f.Close() }()

	c, err := ParseCollection(f)
	require.NoError(t, err)

	req := c.Item[0].Item[0]
	require.Len(t, req.Event, 2)
	testScript := req.Event[1]
	assert.Equal(t, "test", testScript.Listen)
	assert.Contains(t, ScriptBody(testScript.Script), "pm.test")
}

func TestParseCollection_RawJSONBody(t *testing.T) {
	f, err := os.Open("testdata/collection_v21.json")
	require.NoError(t, err)
	defer func() { _ = f.Close() }()

	c, err := ParseCollection(f)
	require.NoError(t, err)

	req := c.Item[1].Item[0]
	require.NotNil(t, req.Request.Body)
	assert.Equal(t, BodyModeRaw, req.Request.Body.Mode)
	assert.Contains(t, req.Request.Body.Raw, "Hello World")
	require.NotNil(t, req.Request.Body.Options)
	assert.Equal(t, "json", req.Request.Body.Options.Raw.Language)
}

func TestParseCollection_FormDataBody(t *testing.T) {
	f, err := os.Open("testdata/collection_v21.json")
	require.NoError(t, err)
	defer func() { _ = f.Close() }()

	c, err := ParseCollection(f)
	require.NoError(t, err)

	req := c.Item[1].Item[1]
	require.NotNil(t, req.Request.Body)
	assert.Equal(t, BodyModeFormData, req.Request.Body.Mode)
	require.Len(t, req.Request.Body.FormData, 2)
	assert.Equal(t, "brand", req.Request.Body.FormData[0].Key)
}

func TestParseCollection_URLEncodedBody(t *testing.T) {
	f, err := os.Open("testdata/collection_v21.json")
	require.NoError(t, err)
	defer func() { _ = f.Close() }()

	c, err := ParseCollection(f)
	require.NoError(t, err)

	req := c.Item[1].Item[2]
	require.NotNil(t, req.Request.Body)
	assert.Equal(t, BodyModeURLEncoded, req.Request.Body.Mode)
	require.Len(t, req.Request.Body.URLEncoded, 2)
	assert.Equal(t, "username", req.Request.Body.URLEncoded[0].Key)
}

func TestParseCollection_NoAuthOnRequest(t *testing.T) {
	f, err := os.Open("testdata/collection_v21.json")
	require.NoError(t, err)
	defer func() { _ = f.Close() }()

	c, err := ParseCollection(f)
	require.NoError(t, err)

	req := c.Item[1].Item[0]
	require.NotNil(t, req.Request.Auth)
	assert.Equal(t, AuthTypeNoAuth, req.Request.Auth.Type)
}

func TestParseCollection_DisabledHeader(t *testing.T) {
	f, err := os.Open("testdata/collection_v21.json")
	require.NoError(t, err)
	defer func() { _ = f.Close() }()

	c, err := ParseCollection(f)
	require.NoError(t, err)

	req := c.Item[2]
	require.NotNil(t, req.Request)
	require.Len(t, req.Request.Header, 1)
	assert.True(t, req.Request.Header[0].Disabled)
}

func TestParseCollection_URLAsString(t *testing.T) {
	f, err := os.Open("testdata/collection_url_string.json")
	require.NoError(t, err)
	defer func() { _ = f.Close() }()

	c, err := ParseCollection(f)
	require.NoError(t, err)

	req := c.Item[0]
	require.NotNil(t, req.Request)
	assert.Equal(t, "https://api.example.com/ping", req.Request.URL.Raw)
}

func TestParseCollection_InvalidSchema(t *testing.T) {
	f, err := os.Open("testdata/collection_invalid_schema.json")
	require.NoError(t, err)
	defer func() { _ = f.Close() }()

	_, err = ParseCollection(f)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "unsupported schema")
}

func TestParseCollection_MissingName(t *testing.T) {
	r := strings.NewReader(`{
		"info": {"schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"},
		"item": []
	}`)
	_, err := ParseCollection(r)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "missing info.name")
}

func TestParseCollection_InvalidJSON(t *testing.T) {
	_, err := ParseCollection(strings.NewReader(`{invalid}`))
	require.Error(t, err)
}

func TestParseCollection_ReadError(t *testing.T) {
	_, err := ParseCollection(errReader{})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "read collection")
}

func TestParseCollectionFile_NotFound(t *testing.T) {
	_, err := ParseCollectionFile("testdata/does_not_exist.json")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "open collection")
}

func TestParseCollection_URLObjectInvalid(t *testing.T) {
	// URL field is neither a string nor a valid URL object
	r := strings.NewReader(`{
		"info": {
			"name": "Bad URL",
			"schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
		},
		"item": [{
			"name": "req",
			"request": { "method": "GET", "url": 42 }
		}]
	}`)
	_, err := ParseCollection(r)
	require.Error(t, err)
}

// ── ParseEnvironment ─────────────────────────────────────────────────────────

func TestParseEnvironment(t *testing.T) {
	f, err := os.Open("testdata/environment.json")
	require.NoError(t, err)
	defer func() { _ = f.Close() }()

	e, err := ParseEnvironment(f)
	require.NoError(t, err)

	assert.Equal(t, "Test - LOCAL", e.Name)
	assert.Equal(t, "bbbbbbbb-0000-0000-0000-000000000001", e.ID)
	assert.Len(t, e.Values, 5)
	assert.Equal(t, "base_url", e.Values[0].Key)
	assert.Equal(t, "https://api.example.com", e.Values[0].Value)
	assert.True(t, e.Values[0].Enabled)
	assert.False(t, e.Values[4].Enabled)
}

func TestParseEnvironment_MissingName(t *testing.T) {
	r := strings.NewReader(`{"id": "abc", "values": []}`)
	_, err := ParseEnvironment(r)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "missing name")
}

func TestParseEnvironment_InvalidJSON(t *testing.T) {
	_, err := ParseEnvironment(strings.NewReader(`not json`))
	require.Error(t, err)
}

func TestParseEnvironment_ReadError(t *testing.T) {
	_, err := ParseEnvironment(errReader{})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "read environment")
}

func TestParseEnvironmentFile_NotFound(t *testing.T) {
	_, err := ParseEnvironmentFile("testdata/does_not_exist.json")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "open environment")
}

// ── Walk ─────────────────────────────────────────────────────────────────────

func TestWalk(t *testing.T) {
	f, err := os.Open("testdata/collection_v21.json")
	require.NoError(t, err)
	defer func() { _ = f.Close() }()

	c, err := ParseCollection(f)
	require.NoError(t, err)

	var names []string
	Walk(c, func(_ []Item, req Item) {
		names = append(names, req.Name)
	})

	// 2 in Articles + 3 in Auth + 1 top-level = 6 requests
	assert.Len(t, names, 6)
	assert.Contains(t, names, "Get article by id")
	assert.Contains(t, names, "Login (urlencoded)")
}

func TestWalk_FolderChain(t *testing.T) {
	f, err := os.Open("testdata/collection_v21.json")
	require.NoError(t, err)
	defer func() { _ = f.Close() }()

	c, err := ParseCollection(f)
	require.NoError(t, err)

	var chains [][]string
	Walk(c, func(folders []Item, req Item) {
		chain := make([]string, len(folders))
		for i, folder := range folders {
			chain[i] = folder.Name
		}
		chains = append(chains, chain)
	})

	// Requests inside "Articles" folder have one ancestor
	assert.Equal(t, []string{"Articles"}, chains[0])
	// Requests inside "Auth" folder have one ancestor
	assert.Equal(t, []string{"Auth"}, chains[2])
	// Top-level request has no ancestors
	assert.Empty(t, chains[5])
}

// ── Helpers ──────────────────────────────────────────────────────────────────

// errReader always returns an error on Read.
type errReader struct{}

func (errReader) Read(_ []byte) (int, error) {
	return 0, fmt.Errorf("read error")
}

// ── Integration: real Mezzo collection ───────────────────────────────────────

func TestParseCollection_RealMezzoCollection(t *testing.T) {
	path := "../../fixtures/MEZZO - Tests.postman_collection.json"
	if _, err := os.Stat(path); os.IsNotExist(err) {
		t.Skip("real fixture not present — skipping integration test")
	}

	c, err := ParseCollectionFile(path)
	require.NoError(t, err)

	assert.Equal(t, "MEZZO - Tests", c.Info.Name)

	var count int
	Walk(c, func(_ []Item, _ Item) { count++ })
	assert.Equal(t, 1440, count)
}

func TestParseEnvironment_RealMezzoLocal(t *testing.T) {
	path := "../../fixtures/Mezzo - LOCAL.postman_environment.json"
	if _, err := os.Stat(path); os.IsNotExist(err) {
		t.Skip("real fixture not present — skipping integration test")
	}

	e, err := ParseEnvironmentFile(path)
	require.NoError(t, err)

	assert.Equal(t, "Mezzo - LOCAL", e.Name)
	assert.Equal(t, 51, len(e.Values))
}
