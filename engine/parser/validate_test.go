package parser

import (
	"os"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ── validateAgainstSchema (unit) ─────────────────────────────────────────────

func TestValidateAgainstSchema_InvalidInstanceJSON(t *testing.T) {
	err := validateAgainstSchema([]byte(`{invalid`), compiledV21)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "unmarshal for validation")
}

// ── ParseCollection — JSON Schema enforcement ────────────────────────────────

func TestParseCollection_SchemaRejectsInvalidAuthType(t *testing.T) {
	// AuthType is a plain Go string so json.Unmarshal accepts any value.
	// The v2.1 JSON Schema has an enum constraint on auth.type — it must catch this.
	r := strings.NewReader(`{
		"info": {
			"name": "Bad Auth Type",
			"schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
		},
		"item": [],
		"auth": {"type": "not_a_real_auth_type"}
	}`)
	_, err := ParseCollection(r)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "schema validation")
}

func TestParseCollection_SchemaRejectsMissingItem(t *testing.T) {
	// "item" is required by the v2.1 schema.
	r := strings.NewReader(`{
		"info": {
			"name": "No Items",
			"schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
		}
	}`)
	_, err := ParseCollection(r)
	require.Error(t, err)
}

// ── ParseCollectionV20 — JSON Schema enforcement ─────────────────────────────

func TestParseCollectionV20_SchemaRejectsV21Auth(t *testing.T) {
	// v2.0 schema requires auth params to be a plain object, not an array.
	r := strings.NewReader(`{
		"info": {
			"name": "Bad Auth v2.0",
			"schema": "https://schema.getpostman.com/json/collection/v2.0.0/collection.json"
		},
		"item": [],
		"auth": {
			"type": "basic",
			"basic": [{"key": "username", "value": "foo", "type": "string"}]
		}
	}`)
	_, err := ParseCollectionV20(r)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "schema validation")
}

func TestParseCollectionV20_SchemaRejectsMissingItem(t *testing.T) {
	r := strings.NewReader(`{
		"info": {
			"name": "No Items v2.0",
			"schema": "https://schema.getpostman.com/json/collection/v2.0.0/collection.json"
		}
	}`)
	_, err := ParseCollectionV20(r)
	require.Error(t, err)
}

// ── Cross-validation: real fixtures pass the right schema ────────────────────

func TestValidateAgainstSchema_V21FixturePassesV21Schema(t *testing.T) {
	f, err := os.Open("testdata/collection_v21.json")
	require.NoError(t, err)
	defer func() { _ = f.Close() }()

	c, err := ParseCollection(f)
	require.NoError(t, err)
	assert.Equal(t, SchemaV21, c.Info.Schema)
}

func TestValidateAgainstSchema_V20FixturePassesV20Schema(t *testing.T) {
	f, err := os.Open("testdata/collection_v20.json")
	require.NoError(t, err)
	defer func() { _ = f.Close() }()

	c, err := ParseCollectionV20(f)
	require.NoError(t, err)
	assert.Equal(t, SchemaV20, c.Info.Schema)
}
