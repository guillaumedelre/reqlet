package main

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/guillaumedelre/reqlet/engine/parser"
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
								Mode:    parser.BodyModeRaw,
								Raw:     `{"name":"Alice"}`,
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

// ---------------------------------------------------------------------------
// Auth type coverage
// ---------------------------------------------------------------------------

func authCollection(auth *parser.Auth) *parser.Collection {
	return &parser.Collection{
		Info: parser.Info{Name: "Auth", Schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"},
		Auth: auth,
	}
}

func mustFrontendAuth(t *testing.T, auth *parser.Auth) map[string]interface{} {
	t.Helper()
	raw, err := CollectionToFrontend(authCollection(auth))
	require.NoError(t, err)
	var out map[string]interface{}
	require.NoError(t, json.Unmarshal(raw, &out))
	return out["auth"].(map[string]interface{})
}

func TestConvertAuthToFrontend_AllTypes(t *testing.T) {
	cases := []struct {
		name     string
		auth     *parser.Auth
		wantType string
	}{
		{"basic", &parser.Auth{Type: parser.AuthTypeBasic, Basic: []parser.AuthParam{
			{Key: "username", Value: "user", Type: "string"},
			{Key: "password", Value: "pass", Type: "string"},
		}}, "basic"},
		{"api-key", &parser.Auth{Type: parser.AuthTypeAPIKey, APIKey: []parser.AuthParam{
			{Key: "key", Value: "X-API-Key", Type: "string"},
			{Key: "value", Value: "secret", Type: "string"},
			{Key: "in", Value: "header", Type: "string"},
		}}, "api-key"},
		{"digest", &parser.Auth{Type: parser.AuthTypeDigest, Digest: []parser.AuthParam{
			{Key: "username", Value: "user", Type: "string"},
			{Key: "password", Value: "pass", Type: "string"},
		}}, "digest"},
		{"oauth1", &parser.Auth{Type: parser.AuthTypeOAuth1, OAuth1: []parser.AuthParam{
			{Key: "consumerKey", Value: "ck", Type: "string"},
			{Key: "consumerSecret", Value: "cs", Type: "string"},
			{Key: "token", Value: "tok", Type: "string"},
			{Key: "tokenSecret", Value: "ts", Type: "string"},
			{Key: "signatureMethod", Value: "HMAC-SHA1", Type: "string"},
		}}, "oauth1"},
		{"oauth2", &parser.Auth{Type: parser.AuthTypeOAuth2, OAuth2: []parser.AuthParam{
			{Key: "grant_type", Value: "authorization_code", Type: "string"},
			{Key: "accessToken", Value: "at", Type: "string"},
			{Key: "tokenType", Value: "Bearer", Type: "string"},
			{Key: "addTokenTo", Value: "header", Type: "string"},
		}}, "oauth2"},
		{"hawk", &parser.Auth{Type: parser.AuthTypeHawk, Hawk: []parser.AuthParam{
			{Key: "authId", Value: "id", Type: "string"},
			{Key: "authKey", Value: "key", Type: "string"},
			{Key: "algorithm", Value: "sha256", Type: "string"},
		}}, "hawk"},
		{"aws-signature", &parser.Auth{Type: parser.AuthTypeAWSV4, AWSV4: []parser.AuthParam{
			{Key: "accessKey", Value: "ak", Type: "string"},
			{Key: "secretKey", Value: "sk", Type: "string"},
			{Key: "region", Value: "us-east-1", Type: "string"},
			{Key: "service", Value: "execute-api", Type: "string"},
			{Key: "sessionToken", Value: "", Type: "string"},
		}}, "aws-signature"},
		{"ntlm", &parser.Auth{Type: parser.AuthTypeNTLM, NTLM: []parser.AuthParam{
			{Key: "username", Value: "user", Type: "string"},
			{Key: "password", Value: "pass", Type: "string"},
			{Key: "domain", Value: "CORP", Type: "string"},
			{Key: "workstation", Value: "WS1", Type: "string"},
		}}, "ntlm"},
		{"unknown → none", &parser.Auth{Type: "unknown_type"}, "none"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			fa := mustFrontendAuth(t, tc.auth)
			assert.Equal(t, tc.wantType, fa["type"])
		})
	}
}

func TestConvertAuthToFrontend_BasicFields(t *testing.T) {
	fa := mustFrontendAuth(t, &parser.Auth{
		Type: parser.AuthTypeBasic,
		Basic: []parser.AuthParam{
			{Key: "username", Value: "alice", Type: "string"},
			{Key: "password", Value: "s3cr3t", Type: "string"},
		},
	})
	basic := fa["basic"].(map[string]interface{})
	assert.Equal(t, "alice", basic["username"])
	assert.Equal(t, "s3cr3t", basic["password"])
}

func TestConvertAuthToFrontend_AWSFields(t *testing.T) {
	fa := mustFrontendAuth(t, &parser.Auth{
		Type: parser.AuthTypeAWSV4,
		AWSV4: []parser.AuthParam{
			{Key: "accessKey", Value: "AKID", Type: "string"},
			{Key: "secretKey", Value: "secret", Type: "string"},
			{Key: "region", Value: "eu-west-1", Type: "string"},
			{Key: "service", Value: "s3", Type: "string"},
			{Key: "sessionToken", Value: "tok", Type: "string"},
		},
	})
	aws := fa["awsSignature"].(map[string]interface{})
	assert.Equal(t, "AKID", aws["accessKey"])
	assert.Equal(t, "eu-west-1", aws["region"])
	assert.Equal(t, "tok", aws["sessionToken"])
}

func TestConvertAuthToParser_AllTypes(t *testing.T) {
	cases := []struct {
		name     string
		fa       feAuth
		wantType parser.AuthType
	}{
		{"bearer", feAuth{Type: "bearer", Bearer: &feAuthBearer{Token: "tok"}}, parser.AuthTypeBearer},
		{"basic", feAuth{Type: "basic", Basic: &feAuthBasic{Username: "u", Password: "p"}}, parser.AuthTypeBasic},
		{"api-key", feAuth{Type: "api-key", APIKey: &feAuthAPIKey{Key: "k", Value: "v", AddTo: "header"}}, parser.AuthTypeAPIKey},
		{"digest", feAuth{Type: "digest", Digest: &feAuthDigest{Username: "u", Password: "p"}}, parser.AuthTypeDigest},
		{"oauth1", feAuth{Type: "oauth1", OAuth1: &feAuthOAuth1{ConsumerKey: "ck"}}, parser.AuthTypeOAuth1},
		{"oauth2", feAuth{Type: "oauth2", OAuth2: &feAuthOAuth2{GrantType: "authorization_code"}}, parser.AuthTypeOAuth2},
		{"hawk", feAuth{Type: "hawk", Hawk: &feAuthHawk{AuthID: "id", AuthKey: "key", Algorithm: "sha256"}}, parser.AuthTypeHawk},
		{"aws-signature", feAuth{Type: "aws-signature", AWSSignature: &feAuthAWSSignature{AccessKey: "ak", SecretKey: "sk"}}, parser.AuthTypeAWSV4},
		{"ntlm", feAuth{Type: "ntlm", NTLM: &feAuthNTLM{Username: "u", Password: "p"}}, parser.AuthTypeNTLM},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			a := convertAuthToParser(tc.fa)
			require.NotNil(t, a)
			assert.Equal(t, tc.wantType, a.Type)
		})
	}
}

func TestConvertAuthToParser_NilSubfields(t *testing.T) {
	// nil sub-struct should not panic and produce empty params slice
	cases := []feAuth{
		{Type: "bearer"},
		{Type: "basic"},
		{Type: "api-key"},
		{Type: "digest"},
		{Type: "oauth1"},
		{Type: "oauth2"},
		{Type: "hawk"},
		{Type: "aws-signature"},
		{Type: "ntlm"},
	}
	for _, fa := range cases {
		t.Run(fa.Type, func(t *testing.T) {
			a := convertAuthToParser(fa)
			require.NotNil(t, a)
		})
	}
}

func TestConvertAuthToParser_DefaultReturnsNil(t *testing.T) {
	assert.Nil(t, convertAuthToParser(feAuth{Type: "unknown"}))
}

// ---------------------------------------------------------------------------
// Body mode coverage
// ---------------------------------------------------------------------------

func TestConvertBodyToFrontend_AllModes(t *testing.T) {
	t.Run("form-data", func(t *testing.T) {
		fb := convertBodyToFrontend(&parser.Body{
			Mode: parser.BodyModeFormData,
			FormData: []parser.FormDataParam{
				{Key: "file", Value: "", Src: "photo.jpg", Type: "file", Disabled: false},
				{Key: "name", Value: "Alice", Type: "text", Disabled: true},
			},
		})
		assert.Equal(t, "form-data", fb.Type)
		require.Len(t, fb.FormData, 2)
		assert.Equal(t, "file", fb.FormData[0].ValueType)
		assert.Equal(t, "photo.jpg", fb.FormData[0].FileName)
		assert.True(t, fb.FormData[0].Enabled)
		assert.False(t, fb.FormData[1].Enabled)
	})

	t.Run("form-data empty type defaults to text", func(t *testing.T) {
		fb := convertBodyToFrontend(&parser.Body{
			Mode:     parser.BodyModeFormData,
			FormData: []parser.FormDataParam{{Key: "k", Value: "v"}},
		})
		assert.Equal(t, "text", fb.FormData[0].ValueType)
	})

	t.Run("urlencoded", func(t *testing.T) {
		fb := convertBodyToFrontend(&parser.Body{
			Mode: parser.BodyModeURLEncoded,
			URLEncoded: []parser.URLEncodedParam{
				{Key: "grant_type", Value: "client_credentials", Disabled: false},
			},
		})
		assert.Equal(t, "x-www-form-urlencoded", fb.Type)
		require.Len(t, fb.URLEncoded, 1)
		assert.Equal(t, "grant_type", fb.URLEncoded[0].Key)
		assert.True(t, fb.URLEncoded[0].Enabled)
	})

	t.Run("graphql", func(t *testing.T) {
		fb := convertBodyToFrontend(&parser.Body{
			Mode:    parser.BodyModeGraphQL,
			GraphQL: &parser.GraphQLBody{Query: "{ users { id } }", Variables: `{"limit":10}`},
		})
		assert.Equal(t, "graphql", fb.Type)
		assert.Equal(t, "{ users { id } }", fb.GraphQLQuery)
		assert.Equal(t, `{"limit":10}`, fb.GraphQLVars)
	})

	t.Run("graphql nil body", func(t *testing.T) {
		fb := convertBodyToFrontend(&parser.Body{Mode: parser.BodyModeGraphQL})
		assert.Equal(t, "graphql", fb.Type)
		assert.Equal(t, "", fb.GraphQLQuery)
	})

	t.Run("binary/file", func(t *testing.T) {
		fb := convertBodyToFrontend(&parser.Body{Mode: parser.BodyModeFile})
		assert.Equal(t, "binary", fb.Type)
	})

	t.Run("unknown mode → none", func(t *testing.T) {
		fb := convertBodyToFrontend(&parser.Body{Mode: "unknown"})
		assert.Equal(t, "none", fb.Type)
	})
}

func TestConvertBodyToFrontend_RawContentTypes(t *testing.T) {
	langs := []struct{ lang, wantCT string }{
		{"json", "application/json"},
		{"xml", "application/xml"},
		{"text", "text/plain"},
		{"html", "text/html"},
		{"javascript", "application/javascript"},
		{"", "application/json"},
	}
	for _, tc := range langs {
		t.Run(tc.lang, func(t *testing.T) {
			var opts *parser.BodyOptions
			if tc.lang != "" {
				opts = &parser.BodyOptions{Raw: &parser.RawOptions{Language: tc.lang}}
			}
			fb := convertBodyToFrontend(&parser.Body{Mode: parser.BodyModeRaw, Raw: "data", Options: opts})
			assert.Equal(t, tc.wantCT, fb.RawContentType)
		})
	}
}

func TestConvertBodyToParser_AllModes(t *testing.T) {
	t.Run("form-data", func(t *testing.T) {
		b := convertBodyToParser(feBody{
			Type:     "form-data",
			FormData: []feFormDataItem{{Key: "f", Value: "v", ValueType: "text", Enabled: true}},
		})
		require.NotNil(t, b)
		assert.Equal(t, parser.BodyModeFormData, b.Mode)
		require.Len(t, b.FormData, 1)
		assert.False(t, b.FormData[0].Disabled)
	})

	t.Run("urlencoded", func(t *testing.T) {
		b := convertBodyToParser(feBody{
			Type:       "x-www-form-urlencoded",
			URLEncoded: []feKV{{Key: "k", Value: "v", Enabled: true}},
		})
		require.NotNil(t, b)
		assert.Equal(t, parser.BodyModeURLEncoded, b.Mode)
		require.Len(t, b.URLEncoded, 1)
		assert.False(t, b.URLEncoded[0].Disabled)
	})

	t.Run("graphql", func(t *testing.T) {
		b := convertBodyToParser(feBody{
			Type:         "graphql",
			GraphQLQuery: "{ me }",
			GraphQLVars:  "{}",
		})
		require.NotNil(t, b)
		assert.Equal(t, parser.BodyModeGraphQL, b.Mode)
		assert.Equal(t, "{ me }", b.GraphQL.Query)
	})

	t.Run("binary", func(t *testing.T) {
		b := convertBodyToParser(feBody{Type: "binary"})
		require.NotNil(t, b)
		assert.Equal(t, parser.BodyModeFile, b.Mode)
	})

	t.Run("raw xml", func(t *testing.T) {
		b := convertBodyToParser(feBody{Type: "raw", Raw: "<x/>", RawContentType: "application/xml"})
		require.NotNil(t, b)
		assert.Equal(t, "xml", b.Options.Raw.Language)
	})

	t.Run("raw text", func(t *testing.T) {
		b := convertBodyToParser(feBody{Type: "raw", RawContentType: "text/plain"})
		assert.Equal(t, "text", b.Options.Raw.Language)
	})

	t.Run("raw html", func(t *testing.T) {
		b := convertBodyToParser(feBody{Type: "raw", RawContentType: "text/html"})
		assert.Equal(t, "html", b.Options.Raw.Language)
	})

	t.Run("raw javascript", func(t *testing.T) {
		b := convertBodyToParser(feBody{Type: "raw", RawContentType: "application/javascript"})
		assert.Equal(t, "javascript", b.Options.Raw.Language)
	})

	t.Run("unknown → nil", func(t *testing.T) {
		assert.Nil(t, convertBodyToParser(feBody{Type: "multipart"}))
	})
}

// ---------- authParamStr ----------

func TestAuthParamStr_NonStringValue(t *testing.T) {
	params := []parser.AuthParam{{Key: "count", Value: 42, Type: "number"}}
	assert.Equal(t, "42", authParamStr(params, "count"))
}

func TestAuthParamStr_KeyNotFound(t *testing.T) {
	params := []parser.AuthParam{{Key: "other", Value: "v", Type: "string"}}
	assert.Equal(t, "", authParamStr(params, "missing"))
}

// ---------- convertItemToFrontend ----------

func TestConvertItemToFrontend_QueryParams(t *testing.T) {
	item := parser.Item{
		Name: "Search",
		Request: &parser.Request{
			Method: "GET",
			URL: parser.URL{
				Raw: "https://api.example.com/search",
				Query: []parser.QueryParam{
					{Key: "q", Value: "hello", Disabled: false},
					{Key: "page", Value: "2", Disabled: true},
				},
			},
		},
	}
	raw := convertItemToFrontend(item)
	var out map[string]interface{}
	require.NoError(t, json.Unmarshal(raw, &out))
	params := out["params"].([]interface{})
	require.Len(t, params, 2)
	first := params[0].(map[string]interface{})
	assert.Equal(t, "q", first["key"])
	assert.Equal(t, true, first["enabled"])
}

func TestConvertItemToFrontend_NilRequest(t *testing.T) {
	item := parser.Item{Name: "Empty", Request: nil}
	raw := convertItemToFrontend(item)
	var out map[string]interface{}
	require.NoError(t, json.Unmarshal(raw, &out))
	assert.Equal(t, "GET", out["method"])
	auth := out["auth"].(map[string]interface{})
	assert.Equal(t, "inherit", auth["type"])
}

// ---------- convertItemToParser ----------

func TestConvertItemToParser_ProbeError(t *testing.T) {
	_, err := convertItemToParser(json.RawMessage(`{invalid json`))
	require.Error(t, err)
	assert.Contains(t, err.Error(), "probe item")
}

func TestConvertItemToParser_WithParams(t *testing.T) {
	raw := json.RawMessage(`{
		"id":"r1","name":"Search","method":"GET","url":"https://api.example.com/search",
		"params":[{"key":"q","value":"test","enabled":true},{"key":"page","value":"1","enabled":false}],
		"headers":[],"body":{"type":"none"},"auth":{"type":"inherit"}
	}`)
	item, err := convertItemToParser(raw)
	require.NoError(t, err)
	require.Len(t, item.Request.URL.Query, 2)
	assert.Equal(t, "q", item.Request.URL.Query[0].Key)
	assert.False(t, item.Request.URL.Query[0].Disabled)
	assert.True(t, item.Request.URL.Query[1].Disabled)
}

func TestConvertItemToParser_InvalidChild(t *testing.T) {
	raw := json.RawMessage(`{"name":"folder","items":["not an object"]}`)
	_, err := convertItemToParser(raw)
	require.Error(t, err)
}

func TestConvertItemToParser_UnmarshalRequestError(t *testing.T) {
	// method is present (non-empty) so the request branch is taken, but
	// "params" is a number instead of an array — triggers the unmarshal error.
	raw := json.RawMessage(`{"method":"GET","params":42}`)
	_, err := convertItemToParser(raw)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "unmarshal request")
}

func TestConvertItemToParser_UnmarshalFolderError(t *testing.T) {
	// No "method" field → folder branch. "items" is a number instead of array.
	raw := json.RawMessage(`{"name":"folder","items":42}`)
	_, err := convertItemToParser(raw)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "unmarshal folder")
}

// ---------- CollectionToParser ----------

func TestCollectionToParser_InvalidJSON(t *testing.T) {
	_, err := CollectionToParser(json.RawMessage(`not json`))
	require.Error(t, err)
	assert.Contains(t, err.Error(), "unmarshal collection")
}

func TestCollectionToParser_InvalidItem(t *testing.T) {
	raw := json.RawMessage(`{"id":"c1","name":"C","items":["not an object"],"variables":[],"auth":{"type":"none"}}`)
	_, err := CollectionToParser(raw)
	require.Error(t, err)
}

// ---------- EnvironmentToParser ----------

func TestEnvironmentToParser_InvalidJSON(t *testing.T) {
	_, err := EnvironmentToParser(json.RawMessage(`not json`))
	require.Error(t, err)
	assert.Contains(t, err.Error(), "unmarshal environment")
}
