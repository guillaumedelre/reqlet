package parser

import (
	"os"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestParseCollectionV10(t *testing.T) {
	f, err := os.Open("testdata/collection_v10.json")
	require.NoError(t, err)
	defer func() { _ = f.Close() }()

	c, err := ParseCollectionV10(f)
	require.NoError(t, err)

	assert.Equal(t, "Reqlet Test Collection v1.0", c.Name)
	assert.Equal(t, "cccccccc-0000-0000-0000-000000000001", c.ID)
	assert.Len(t, c.Requests, 3)
	assert.Len(t, c.Folders, 1)
	assert.Equal(t, []string{"req-001", "req-003"}, c.Order)
}

func TestParseCollectionV10_Folder(t *testing.T) {
	f, err := os.Open("testdata/collection_v10.json")
	require.NoError(t, err)
	defer func() { _ = f.Close() }()

	c, err := ParseCollectionV10(f)
	require.NoError(t, err)

	folder := c.Folders[0]
	assert.Equal(t, "folder-001", folder.ID)
	assert.Equal(t, "Articles", folder.Name)
	assert.Equal(t, []string{"req-002"}, folder.Order)
}

func TestParseCollectionV10_Request(t *testing.T) {
	f, err := os.Open("testdata/collection_v10.json")
	require.NoError(t, err)
	defer func() { _ = f.Close() }()

	c, err := ParseCollectionV10(f)
	require.NoError(t, err)

	req := c.Requests[0]
	assert.Equal(t, "req-001", req.ID)
	assert.Equal(t, "Ping", req.Name)
	assert.Equal(t, "GET", req.Method)
	assert.Equal(t, "{{base_url}}/ping", req.URL)
	assert.Contains(t, req.Headers, "Accept: application/json")
	assert.Nil(t, req.Folder)
	assert.NotEmpty(t, req.Tests)
}

func TestParseCollectionV10_FolderRequest(t *testing.T) {
	f, err := os.Open("testdata/collection_v10.json")
	require.NoError(t, err)
	defer func() { _ = f.Close() }()

	c, err := ParseCollectionV10(f)
	require.NoError(t, err)

	req := c.Requests[1]
	assert.Equal(t, "req-002", req.ID)
	require.NotNil(t, req.Folder)
	assert.Equal(t, "folder-001", *req.Folder)
	assert.NotEmpty(t, req.PreRequestScript)
}

func TestParseCollectionV10_MissingName(t *testing.T) {
	r := strings.NewReader(`{"id":"abc","order":[],"folders":[],"requests":[]}`)
	_, err := ParseCollectionV10(r)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "missing name")
}

func TestParseCollectionV10_InvalidJSON(t *testing.T) {
	_, err := ParseCollectionV10(strings.NewReader(`{invalid}`))
	require.Error(t, err)
}

func TestParseCollectionV10_ReadError(t *testing.T) {
	_, err := ParseCollectionV10(errReader{})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "read collection")
}
