package main

import (
	"encoding/json"
	"testing"

	"github.com/guillaumedelre/reqlet/engine/parser"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func minimalCollection() *parser.Collection {
	return &parser.Collection{
		Info: parser.Info{
			PostmanID: "test-id-123",
			Name:      "Test Collection",
			Schema:    "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
		},
		Auth: &parser.Auth{
			Type:   parser.AuthTypeBearer,
			Bearer: []parser.AuthParam{{Key: "token", Value: "mytoken", Type: "string"}},
		},
		Variable: []parser.Variable{
			{Key: "baseUrl", Value: "https://api.example.com", Disabled: false},
		},
		Event: []parser.Event{
			{Listen: "prerequest", Script: parser.Script{Type: "text/javascript", Exec: []string{"console.log('pre')"}}},
		},
		Item: []parser.Item{
			{
				Name: "Get Users",
				Request: &parser.Request{
					Method: "GET",
					URL:    parser.URL{Raw: "{{baseUrl}}/users"},
					Header: []parser.Header{
						{Key: "Accept", Value: "application/json", Disabled: false},
					},
				},
				Event: []parser.Event{
					{Listen: "test", Script: parser.Script{Type: "text/javascript", Exec: []string{"pm.test('ok', () => pm.response.to.have.status(200))"}}},
				},
			},
			{
				Name: "Users Folder",
				Item: []parser.Item{
					{
						Name: "Create User",
						Request: &parser.Request{
							Method: "POST",
							URL:    parser.URL{Raw: "{{baseUrl}}/users"},
							Body: &parser.Body{
								Mode: parser.BodyModeRaw,
								Raw:  `{"name":"Alice"}`,
								Options: &parser.BodyOptions{Raw: &parser.RawOptions{Language: "json"}},
							},
						},
					},
				},
			},
		},
	}
}

func TestCollectionToFrontend_Basic(t *testing.T) {
	col := minimalCollection()
	raw, err := CollectionToFrontend(col)
	require.NoError(t, err)

	var out map[string]interface{}
	require.NoError(t, json.Unmarshal(raw, &out))

	assert.Equal(t, "test-id-123", out["id"])
	assert.Equal(t, "Test Collection", out["name"])

	items, ok := out["items"].([]interface{})
	require.True(t, ok)
	assert.Len(t, items, 2)

	// Check auth converted
	auth, ok := out["auth"].(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, "bearer", auth["type"])
	bearer, ok := auth["bearer"].(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, "mytoken", bearer["token"])

	// Check variables
	vars, ok := out["variables"].([]interface{})
	require.True(t, ok)
	assert.Len(t, vars, 1)
	v0 := vars[0].(map[string]interface{})
	assert.Equal(t, "baseUrl", v0["key"])
	assert.Equal(t, "https://api.example.com", v0["initialValue"])
	assert.Equal(t, "https://api.example.com", v0["currentValue"])
	assert.Equal(t, true, v0["enabled"])

	// Check preRequestScript
	assert.Equal(t, "console.log('pre')", out["preRequestScript"])
}

func TestCollectionToFrontend_ItemsCount(t *testing.T) {
	col := minimalCollection()
	raw, err := CollectionToFrontend(col)
	require.NoError(t, err)

	var out map[string]interface{}
	require.NoError(t, json.Unmarshal(raw, &out))

	items := out["items"].([]interface{})
	assert.Len(t, items, 2)

	// folder
	folder := items[1].(map[string]interface{})
	assert.Equal(t, "Users Folder", folder["name"])
	folderItems := folder["items"].([]interface{})
	assert.Len(t, folderItems, 1)

	// request within folder
	req := folderItems[0].(map[string]interface{})
	assert.Equal(t, "Create User", req["name"])
	assert.Equal(t, "POST", req["method"])
}

func TestCollectionToParser_Export(t *testing.T) {
	col := minimalCollection()
	raw, err := CollectionToFrontend(col)
	require.NoError(t, err)

	out, err := CollectionToParser(raw)
	require.NoError(t, err)

	assert.Equal(t, "Test Collection", out.Info.Name)
	assert.Equal(t, "https://schema.getpostman.com/json/collection/v2.1.0/collection.json", out.Info.Schema)
	assert.Len(t, out.Item, 2)
}

func TestCollectionRoundTrip(t *testing.T) {
	col := minimalCollection()
	raw, err := CollectionToFrontend(col)
	require.NoError(t, err)

	back, err := CollectionToParser(raw)
	require.NoError(t, err)

	assert.Equal(t, col.Info.Name, back.Info.Name)

	countRequests := func(items []parser.Item) int {
		count := 0
		var walk func([]parser.Item)
		walk = func(items []parser.Item) {
			for _, item := range items {
				if item.IsFolder() {
					walk(item.Item)
				} else {
					count++
				}
			}
		}
		walk(items)
		return count
	}

	assert.Equal(t, countRequests(col.Item), countRequests(back.Item))
}

func TestEnvironmentToFrontend(t *testing.T) {
	env := &parser.Environment{
		ID:   "env-id-1",
		Name: "Production",
		Values: []parser.EnvironmentValue{
			{Key: "API_URL", Value: "https://prod.api.com", Enabled: true, Type: "default"},
			{Key: "SECRET", Value: "s3cr3t", Enabled: false, Type: "secret"},
		},
	}

	raw, err := EnvironmentToFrontend(env)
	require.NoError(t, err)

	var out map[string]interface{}
	require.NoError(t, json.Unmarshal(raw, &out))

	assert.Equal(t, "env-id-1", out["id"])
	assert.Equal(t, "Production", out["name"])

	vars, ok := out["variables"].([]interface{})
	require.True(t, ok)
	assert.Len(t, vars, 2)

	v0 := vars[0].(map[string]interface{})
	assert.Equal(t, "API_URL", v0["key"])
	assert.Equal(t, "https://prod.api.com", v0["initialValue"])
	assert.Equal(t, "https://prod.api.com", v0["currentValue"])
	assert.Equal(t, true, v0["enabled"])

	v1 := vars[1].(map[string]interface{})
	assert.Equal(t, "SECRET", v1["key"])
	assert.Equal(t, false, v1["enabled"])
}

func TestEnvironmentRoundTrip(t *testing.T) {
	env := &parser.Environment{
		ID:   "env-rt",
		Name: "Staging",
		Values: []parser.EnvironmentValue{
			{Key: "HOST", Value: "staging.example.com", Enabled: true},
		},
	}

	raw, err := EnvironmentToFrontend(env)
	require.NoError(t, err)

	back, err := EnvironmentToParser(raw)
	require.NoError(t, err)

	assert.Equal(t, env.Name, back.Name)
	require.Len(t, back.Values, 1)
	assert.Equal(t, "HOST", back.Values[0].Key)
	assert.Equal(t, "staging.example.com", back.Values[0].Value)
	assert.True(t, back.Values[0].Enabled)
}

func TestAuthNilToInherit(t *testing.T) {
	col := &parser.Collection{
		Info: parser.Info{Name: "Auth Test"},
		Item: []parser.Item{
			{
				Name: "No Auth Request",
				Request: &parser.Request{
					Method: "GET",
					URL:    parser.URL{Raw: "https://example.com"},
					Auth:   nil,
				},
			},
		},
	}

	raw, err := CollectionToFrontend(col)
	require.NoError(t, err)

	var out map[string]interface{}
	require.NoError(t, json.Unmarshal(raw, &out))

	// collection root with nil auth → "none"
	auth := out["auth"].(map[string]interface{})
	assert.Equal(t, "none", auth["type"])

	// request item with nil auth → "inherit"
	items := out["items"].([]interface{})
	reqItem := items[0].(map[string]interface{})
	reqAuth := reqItem["auth"].(map[string]interface{})
	assert.Equal(t, "inherit", reqAuth["type"])
}

func TestAuthNoauthToNone(t *testing.T) {
	col := &parser.Collection{
		Info: parser.Info{Name: "Noauth Test"},
		Auth: &parser.Auth{Type: parser.AuthTypeNoAuth},
	}

	raw, err := CollectionToFrontend(col)
	require.NoError(t, err)

	var out map[string]interface{}
	require.NoError(t, json.Unmarshal(raw, &out))

	auth := out["auth"].(map[string]interface{})
	assert.Equal(t, "none", auth["type"])
}

func TestBodyNilToNone(t *testing.T) {
	col := &parser.Collection{
		Info: parser.Info{Name: "Body Test"},
		Item: []parser.Item{
			{
				Name: "Nil Body",
				Request: &parser.Request{
					Method: "GET",
					URL:    parser.URL{Raw: "https://example.com"},
					Body:   nil,
				},
			},
		},
	}

	raw, err := CollectionToFrontend(col)
	require.NoError(t, err)

	var out map[string]interface{}
	require.NoError(t, json.Unmarshal(raw, &out))

	items := out["items"].([]interface{})
	req := items[0].(map[string]interface{})
	body := req["body"].(map[string]interface{})
	assert.Equal(t, "none", body["type"])

	// params and headers must be arrays, not null
	params, ok := req["params"].([]interface{})
	require.True(t, ok)
	assert.NotNil(t, params)

	headers, ok := req["headers"].([]interface{})
	require.True(t, ok)
	assert.NotNil(t, headers)
}

func TestSanitizeFilename(t *testing.T) {
	assert.Equal(t, "My_Collection", sanitizeFilename("My/Collection"))
	assert.Equal(t, "Test Collection", sanitizeFilename("Test Collection"))
	assert.Equal(t, "foo-bar_baz", sanitizeFilename("foo-bar_baz"))
	assert.Equal(t, "hello_world", sanitizeFilename("hello<>|world"))
}
