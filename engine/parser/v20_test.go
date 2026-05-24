package parser

import (
	"os"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestParseCollectionV20(t *testing.T) {
	f, err := os.Open("testdata/collection_v20.json")
	require.NoError(t, err)
	defer func() { _ = f.Close() }()

	c, err := ParseCollectionV20(f)
	require.NoError(t, err)

	assert.Equal(t, "Reqlet Test Collection v2.0", c.Info.Name)
	assert.Equal(t, SchemaV20, c.Info.Schema)
	assert.Len(t, c.Item, 2)
	assert.Len(t, c.Variable, 1)
}

func TestParseCollectionV20_FolderAuth(t *testing.T) {
	f, err := os.Open("testdata/collection_v20.json")
	require.NoError(t, err)
	defer func() { _ = f.Close() }()

	c, err := ParseCollectionV20(f)
	require.NoError(t, err)

	authFolder := c.Item[1]
	require.NotNil(t, authFolder.Auth)
	assert.Equal(t, AuthTypeBasic, authFolder.Auth.Type)
	// v2.0 format: params are a JSON object, not an array
	assert.Contains(t, string(authFolder.Auth.Basic), "username")
	assert.Contains(t, string(authFolder.Auth.Basic), "admin_user")
}

func TestParseCollectionV20_URLAsString(t *testing.T) {
	f, err := os.Open("testdata/collection_v20.json")
	require.NoError(t, err)
	defer func() { _ = f.Close() }()

	c, err := ParseCollectionV20(f)
	require.NoError(t, err)

	// URLs in v2.0 fixture are plain strings — UnmarshalJSON handles them.
	req := c.Item[0].Item[0]
	require.NotNil(t, req.Request)
	assert.Equal(t, "{{base_url}}/articles/1", req.Request.URL.Raw)
}

func TestParseCollectionV20_RequestAuth(t *testing.T) {
	f, err := os.Open("testdata/collection_v20.json")
	require.NoError(t, err)
	defer func() { _ = f.Close() }()

	c, err := ParseCollectionV20(f)
	require.NoError(t, err)

	req := c.Item[1].Item[0]
	require.NotNil(t, req.Request.Auth)
	assert.Equal(t, AuthTypeNoAuth, req.Request.Auth.Type)
}

func TestParseCollectionV20_MissingName(t *testing.T) {
	r := strings.NewReader(`{
		"info": {"schema": "https://schema.getpostman.com/json/collection/v2.0.0/collection.json"},
		"item": []
	}`)
	_, err := ParseCollectionV20(r)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "missing info.name")
}

func TestParseCollectionV20_WrongSchema(t *testing.T) {
	r := strings.NewReader(`{
		"info": {"name": "T", "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"},
		"item": []
	}`)
	_, err := ParseCollectionV20(r)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "expected v2.0 schema")
}

func TestParseCollectionV20_InvalidJSON(t *testing.T) {
	_, err := ParseCollectionV20(strings.NewReader(`{invalid}`))
	require.Error(t, err)
}

func TestParseCollectionV20_ReadError(t *testing.T) {
	_, err := ParseCollectionV20(errReader{})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "read collection")
}

func TestItemV20_IsFolder(t *testing.T) {
	folder := ItemV20{Name: "F", Item: []ItemV20{{Name: "child"}}}
	request := ItemV20{Name: "R", Request: &RequestV20{Method: "GET"}}
	assert.True(t, folder.IsFolder())
	assert.False(t, request.IsFolder())
}
