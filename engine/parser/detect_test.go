package parser

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDetectVersion_V21(t *testing.T) {
	data := []byte(`{"info":{"name":"T","schema":"https://schema.getpostman.com/json/collection/v2.1.0/collection.json"},"item":[]}`)
	v, err := DetectVersion(data)
	require.NoError(t, err)
	assert.Equal(t, VersionV21, v)
}

func TestDetectVersion_V20(t *testing.T) {
	data := []byte(`{"info":{"name":"T","schema":"https://schema.getpostman.com/json/collection/v2.0.0/collection.json"},"item":[]}`)
	v, err := DetectVersion(data)
	require.NoError(t, err)
	assert.Equal(t, VersionV20, v)
}

func TestDetectVersion_V10(t *testing.T) {
	data := []byte(`{"id":"abc","name":"T","order":[],"folders":[],"requests":[]}`)
	v, err := DetectVersion(data)
	require.NoError(t, err)
	assert.Equal(t, VersionV10, v)
}

func TestDetectVersion_UnknownSchema(t *testing.T) {
	data := []byte(`{"info":{"name":"T","schema":"https://unknown.com/schema.json"},"item":[]}`)
	_, err := DetectVersion(data)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "unknown schema")
}

func TestDetectVersion_InvalidJSON(t *testing.T) {
	_, err := DetectVersion([]byte(`{invalid`))
	require.Error(t, err)
	assert.Contains(t, err.Error(), "detect version")
}

func TestDetectVersion_EmptyRequests_NotV10(t *testing.T) {
	// "requests": null should not be detected as v1.0 — only a non-null array triggers v1.0
	data := []byte(`{"info":{"name":"T","schema":"https://schema.getpostman.com/json/collection/v2.1.0/collection.json"},"item":[],"requests":null}`)
	v, err := DetectVersion(data)
	require.NoError(t, err)
	assert.Equal(t, VersionV21, v)
}
