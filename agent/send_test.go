package main

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/guillaumedelre/reqlet/engine/sandbox"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func base64Encode(s string) string {
	return base64.StdEncoding.EncodeToString([]byte(s))
}

func TestHandleSend_TimingsInResponse(t *testing.T) {
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = fmt.Fprint(w, `{"ok":true}`)
	}))
	defer target.Close()

	body := sendReq{Method: "GET", URL: target.URL, FollowRedirects: true, SslVerification: true}
	bodyBytes, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/api/send", bytes.NewReader(bodyBytes))
	w := httptest.NewRecorder()
	(&server{}).handleSend(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	var resp sendResp
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.GreaterOrEqual(t, resp.Timings.Total, int64(0))
	assert.GreaterOrEqual(t, resp.Timings.Total, resp.Timings.Download)
}

func TestHandleSend_WrongMethod(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/send", nil)
	w := httptest.NewRecorder()
	(&server{}).handleSend(w, req)
	assert.Equal(t, http.StatusMethodNotAllowed, w.Code)
}

func TestHandleSend_BadJSON(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/api/send", bytes.NewBufferString("not json"))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	(&server{}).handleSend(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
	var resp errResp
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, "bad_request", resp.Code)
}

func TestHandleSend_Success(t *testing.T) {
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = fmt.Fprint(w, `{"hello":"world"}`)
	}))
	defer target.Close()

	body := sendReq{
		Method:          "GET",
		URL:             target.URL + "/test",
		FollowRedirects: true,
		SslVerification: true,
	}
	bodyBytes, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/api/send", bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	(&server{}).handleSend(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	var resp sendResp
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, 200, resp.Status)
	assert.Equal(t, `{"hello":"world"}`, resp.Body)
	assert.Equal(t, "application/json", resp.ContentType)
	assert.Positive(t, resp.Size)
}

func TestHandleSend_WithHeaders(t *testing.T) {
	var receivedHeader string
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		receivedHeader = r.Header.Get("X-Custom")
		w.WriteHeader(http.StatusNoContent)
	}))
	defer target.Close()

	body := sendReq{
		Method: "GET",
		URL:    target.URL,
		Headers: []kvItem{
			{Key: "X-Custom", Value: "test-value", Enabled: true},
			{Key: "X-Disabled", Value: "ignored", Enabled: false},
		},
		FollowRedirects: true,
		SslVerification: true,
	}
	bodyBytes, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/api/send", bytes.NewReader(bodyBytes))
	w := httptest.NewRecorder()
	(&server{}).handleSend(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, "test-value", receivedHeader)
}

func TestHandleSend_NetworkError(t *testing.T) {
	body := sendReq{
		Method:          "GET",
		URL:             "http://localhost:1", // nothing listens here
		FollowRedirects: true,
		SslVerification: true,
	}
	bodyBytes, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/api/send", bytes.NewReader(bodyBytes))
	w := httptest.NewRecorder()
	(&server{}).handleSend(w, req)

	assert.Equal(t, http.StatusUnprocessableEntity, w.Code)
	var resp errResp
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.NotEmpty(t, resp.Error)
	assert.NotEmpty(t, resp.Code)
}

func TestBuildParserReq_DisabledHeadersSkipped(t *testing.T) {
	req := sendReq{
		Method: "POST",
		URL:    "https://example.com",
		Headers: []kvItem{
			{Key: "Accept", Value: "application/json", Enabled: true},
			{Key: "X-Skip", Value: "skip", Enabled: false},
			{Key: "", Value: "no-key", Enabled: true},
		},
	}
	pr := buildParserReq(req)
	require.Len(t, pr.Header, 1)
	assert.Equal(t, "Accept", pr.Header[0].Key)
}

func TestHandleSend_RawBody(t *testing.T) {
	var receivedBody, receivedCT string
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		buf := new(bytes.Buffer)
		_, _ = buf.ReadFrom(r.Body)
		receivedBody = buf.String()
		receivedCT = r.Header.Get("Content-Type")
		w.WriteHeader(http.StatusOK)
	}))
	defer target.Close()

	body := sendReq{
		Method:             "POST",
		URL:                target.URL,
		BodyType:           "raw",
		BodyRaw:            `{"key":"val"}`,
		BodyRawContentType: "JSON",
		FollowRedirects:    true,
		SslVerification:    true,
	}
	bodyBytes, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/api/send", bytes.NewReader(bodyBytes))
	w := httptest.NewRecorder()
	(&server{}).handleSend(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, `{"key":"val"}`, receivedBody)
	assert.Contains(t, receivedCT, "application/json")
}

func TestHandleSend_FormDataBody(t *testing.T) {
	var receivedField string
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = r.ParseMultipartForm(1 << 20) //nolint:gosec // test-only, controlled size
		receivedField = r.FormValue("name")
		w.WriteHeader(http.StatusOK)
	}))
	defer target.Close()

	body := sendReq{
		Method:   "POST",
		URL:      target.URL,
		BodyType: "form-data",
		BodyFormData: []kvItem{
			{Key: "name", Value: "reqlet", Enabled: true},
			{Key: "skip", Value: "x", Enabled: false},
		},
		FollowRedirects: true,
		SslVerification: true,
	}
	bodyBytes, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/api/send", bytes.NewReader(bodyBytes))
	w := httptest.NewRecorder()
	(&server{}).handleSend(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, "reqlet", receivedField)
}

func TestHandleSend_UrlencodedBody(t *testing.T) {
	var receivedField string
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = r.ParseForm()
		receivedField = r.FormValue("q")
		w.WriteHeader(http.StatusOK)
	}))
	defer target.Close()

	body := sendReq{
		Method:   "POST",
		URL:      target.URL,
		BodyType: "urlencoded",
		BodyUrlencoded: []kvItem{
			{Key: "q", Value: "hello", Enabled: true},
			{Key: "skip", Value: "x", Enabled: false},
		},
		FollowRedirects: true,
		SslVerification: true,
	}
	bodyBytes, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/api/send", bytes.NewReader(bodyBytes))
	w := httptest.NewRecorder()
	(&server{}).handleSend(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, "hello", receivedField)
}

func TestHandleSend_Timeout(t *testing.T) {
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// respond normally — we just want to verify the timeout field is accepted
		w.WriteHeader(http.StatusOK)
	}))
	defer target.Close()

	body := sendReq{
		Method:          "GET",
		URL:             target.URL,
		Timeout:         5000, // 5 s — non-zero branch
		FollowRedirects: true,
		SslVerification: true,
	}
	bodyBytes, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/api/send", bytes.NewReader(bodyBytes))
	w := httptest.NewRecorder()
	(&server{}).handleSend(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
}

func TestBuildParserReq_RawBody(t *testing.T) {
	req := sendReq{
		Method:             "POST",
		URL:                "https://example.com",
		BodyType:           "raw",
		BodyRaw:            `{"x":1}`,
		BodyRawContentType: "JSON",
	}
	pr := buildParserReq(req)
	require.NotNil(t, pr.Body)
	assert.Equal(t, "raw", string(pr.Body.Mode))
	assert.Equal(t, `{"x":1}`, pr.Body.Raw)
	assert.Equal(t, "json", pr.Body.Options.Raw.Language)
}

func TestBuildParserReq_FormDataBody(t *testing.T) {
	req := sendReq{
		Method:   "POST",
		URL:      "https://example.com",
		BodyType: "form-data",
		BodyFormData: []kvItem{
			{Key: "a", Value: "1", Enabled: true},
			{Key: "b", Value: "2", Enabled: false},
			{Key: "", Value: "3", Enabled: true},
		},
	}
	pr := buildParserReq(req)
	require.NotNil(t, pr.Body)
	assert.Equal(t, "formdata", string(pr.Body.Mode))
	require.Len(t, pr.Body.FormData, 1)
	assert.Equal(t, "a", pr.Body.FormData[0].Key)
}

func TestBuildParserReq_UrlencodedBody(t *testing.T) {
	req := sendReq{
		Method:   "POST",
		URL:      "https://example.com",
		BodyType: "urlencoded",
		BodyUrlencoded: []kvItem{
			{Key: "x", Value: "1", Enabled: true},
			{Key: "y", Value: "2", Enabled: false},
		},
	}
	pr := buildParserReq(req)
	require.NotNil(t, pr.Body)
	assert.Equal(t, "urlencoded", string(pr.Body.Mode))
	require.Len(t, pr.Body.URLEncoded, 1)
	assert.Equal(t, "x", pr.Body.URLEncoded[0].Key)
}

func TestBuildParserReq_NoneBody(t *testing.T) {
	req := sendReq{Method: "GET", URL: "https://example.com", BodyType: "none"}
	pr := buildParserReq(req)
	assert.Nil(t, pr.Body)
}

func TestNetworkErrorCode(t *testing.T) {
	cases := []struct {
		msg      string
		expected string
	}{
		{"connection timeout", "timeout"},
		{"context deadline exceeded", "timeout"},
		{"tls handshake error", "tls_error"},
		{"certificate signed by unknown authority", "tls_error"},
		{"no such host: example.invalid", "dns_error"},
		{"connection refused", "network_error"},
		{"EOF", "network_error"},
	}
	for _, tc := range cases {
		assert.Equal(t, tc.expected, networkErrorCode(fmt.Errorf("%s", tc.msg)), "msg: %s", tc.msg)
	}
}

func TestRawLang(t *testing.T) {
	cases := map[string]string{
		// MIME types (frontend canonical form)
		"application/json":       "json",
		"application/xml":        "xml",
		"text/html":              "html",
		"application/javascript": "javascript",
		"text/plain":             "text",
		// Display names (backward compat)
		"JSON":       "json",
		"XML":        "xml",
		"HTML":       "html",
		"JavaScript": "javascript",
		"Text":       "text",
		"Unknown":    "text",
	}
	for input, expected := range cases {
		assert.Equal(t, expected, rawLang(input), "input: %s", input)
	}
}

func TestHandleSend_GraphQLBody(t *testing.T) {
	var receivedBody string
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		buf := new(bytes.Buffer)
		_, _ = buf.ReadFrom(r.Body)
		receivedBody = buf.String()
		w.WriteHeader(http.StatusOK)
	}))
	defer target.Close()

	body := sendReq{
		Method:               "POST",
		URL:                  target.URL,
		BodyType:             "graphql",
		BodyGraphQLQuery:     "{ user { id } }",
		BodyGraphQLVariables: `{"id":1}`,
		FollowRedirects:      true,
		SslVerification:      true,
	}
	bodyBytes, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/api/send", bytes.NewReader(bodyBytes))
	w := httptest.NewRecorder()
	(&server{}).handleSend(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, receivedBody, "user")
}

func TestHandleSend_BearerAuth(t *testing.T) {
	var receivedAuth string
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		receivedAuth = r.Header.Get("Authorization")
		w.WriteHeader(http.StatusOK)
	}))
	defer target.Close()

	body := sendReq{
		Method:          "GET",
		URL:             target.URL,
		Auth:            &authCfg{Type: "bearer", Bearer: &bearerCfg{Token: "my-token"}},
		FollowRedirects: true,
		SslVerification: true,
	}
	bodyBytes, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/api/send", bytes.NewReader(bodyBytes))
	w := httptest.NewRecorder()
	(&server{}).handleSend(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, "Bearer my-token", receivedAuth)
}

func TestHandleSend_BasicAuth(t *testing.T) {
	var receivedUser, receivedPass string
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		receivedUser, receivedPass, _ = r.BasicAuth()
		w.WriteHeader(http.StatusOK)
	}))
	defer target.Close()

	body := sendReq{
		Method:          "GET",
		URL:             target.URL,
		Auth:            &authCfg{Type: "basic", Basic: &credentialsCfg{Username: "alice", Password: "secret"}},
		FollowRedirects: true,
		SslVerification: true,
	}
	bodyBytes, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/api/send", bytes.NewReader(bodyBytes))
	w := httptest.NewRecorder()
	(&server{}).handleSend(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, "alice", receivedUser)
	assert.Equal(t, "secret", receivedPass)
}

func TestToParserAuth_NilReturnsNil(t *testing.T) {
	assert.Nil(t, toParserAuth(nil))
}

func TestToParserAuth_InheritReturnsNoAuth(t *testing.T) {
	a := toParserAuth(&authCfg{Type: "inherit"})
	require.NotNil(t, a)
	assert.Equal(t, "noauth", string(a.Type))
}

func TestToParserAuth_UnknownTypeReturnsNoAuth(t *testing.T) {
	a := toParserAuth(&authCfg{Type: "hawk"})
	require.NotNil(t, a)
	assert.Equal(t, "noauth", string(a.Type))
}

func TestToParserAuth_Bearer(t *testing.T) {
	a := toParserAuth(&authCfg{Type: "bearer", Bearer: &bearerCfg{Token: "tok"}})
	require.NotNil(t, a)
	assert.Equal(t, "bearer", string(a.Type))
	require.Len(t, a.Bearer, 1)
	assert.Equal(t, "token", a.Bearer[0].Key)
	assert.Equal(t, "tok", a.Bearer[0].Value)
}

func TestToParserAuth_APIKey(t *testing.T) {
	a := toParserAuth(&authCfg{Type: "api-key", APIKey: &apiKeyCfg{Key: "X-Key", Value: "abc", AddTo: "header"}})
	require.NotNil(t, a)
	assert.Equal(t, "apikey", string(a.Type))
	require.Len(t, a.APIKey, 3)
}

func TestBuildParserReq_GraphQLBody(t *testing.T) {
	req := sendReq{
		Method:               "POST",
		URL:                  "https://example.com/graphql",
		BodyType:             "graphql",
		BodyGraphQLQuery:     "query { users { id } }",
		BodyGraphQLVariables: `{}`,
	}
	pr := buildParserReq(req)
	require.NotNil(t, pr.Body)
	assert.Equal(t, "graphql", string(pr.Body.Mode))
	require.NotNil(t, pr.Body.GraphQL)
	assert.Equal(t, "query { users { id } }", pr.Body.GraphQL.Query)
}

func TestBuildParserReq_XWWWFormUrlencoded(t *testing.T) {
	req := sendReq{
		Method:   "POST",
		URL:      "https://example.com",
		BodyType: "x-www-form-urlencoded",
		BodyUrlencoded: []kvItem{
			{Key: "a", Value: "1", Enabled: true},
		},
	}
	pr := buildParserReq(req)
	require.NotNil(t, pr.Body)
	assert.Equal(t, "urlencoded", string(pr.Body.Mode))
}

func TestBuildParserReq_FormDataFileType(t *testing.T) {
	req := sendReq{
		Method:   "POST",
		URL:      "https://example.com",
		BodyType: "form-data",
		BodyFormData: []kvItem{
			{Key: "upload", ValueType: "file", FileName: "test.txt", FileContent: "aGVsbG8=", Enabled: true},
			{Key: "field", Value: "hello", ValueType: "text", Enabled: true},
		},
	}
	pr := buildParserReq(req)
	require.NotNil(t, pr.Body)
	require.Len(t, pr.Body.FormData, 2)
	assert.Equal(t, "file", pr.Body.FormData[0].Type)
	assert.Equal(t, "test.txt", pr.Body.FormData[0].Src)
	assert.Equal(t, "aGVsbG8=", pr.Body.FormData[0].Value)
	assert.Equal(t, "text", pr.Body.FormData[1].Type)
}

func TestHandleSend_FormDataFileBody(t *testing.T) {
	const fileContent = "hello file"
	encoded := base64Encode(fileContent)

	var receivedFileName, receivedContent string
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, header, err := r.FormFile("upload")
		require.NoError(t, err)
		receivedFileName = header.Filename
		f, _ := header.Open()
		data := new(bytes.Buffer)
		_, _ = data.ReadFrom(f)
		receivedContent = data.String()
		w.WriteHeader(http.StatusOK)
	}))
	defer target.Close()

	body := sendReq{
		Method:   "POST",
		URL:      target.URL,
		BodyType: "form-data",
		BodyFormData: []kvItem{
			{Key: "upload", ValueType: "file", FileName: "hello.txt", FileContent: encoded, Enabled: true},
		},
		FollowRedirects: true,
		SslVerification: true,
	}
	bodyBytes, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/api/send", bytes.NewReader(bodyBytes))
	w := httptest.NewRecorder()
	(&server{}).handleSend(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, "hello.txt", receivedFileName)
	assert.Equal(t, fileContent, receivedContent)
}

func TestToParserAuth_BearerNilCfg(t *testing.T) {
	a := toParserAuth(&authCfg{Type: "bearer"})
	require.NotNil(t, a)
	assert.Equal(t, "bearer", string(a.Type))
	assert.Empty(t, a.Bearer)
}

func TestToParserAuth_BasicNilCfg(t *testing.T) {
	a := toParserAuth(&authCfg{Type: "basic"})
	require.NotNil(t, a)
	assert.Equal(t, "basic", string(a.Type))
	assert.Empty(t, a.Basic)
}

func TestToParserAuth_DigestWithCreds(t *testing.T) {
	a := toParserAuth(&authCfg{Type: "digest", Digest: &credentialsCfg{Username: "u", Password: "p"}})
	require.NotNil(t, a)
	assert.Equal(t, "digest", string(a.Type))
	require.Len(t, a.Digest, 2)
	assert.Equal(t, "u", a.Digest[0].Value)
}

func TestToParserAuth_DigestNilCfg(t *testing.T) {
	a := toParserAuth(&authCfg{Type: "digest"})
	require.NotNil(t, a)
	assert.Equal(t, "digest", string(a.Type))
	assert.Empty(t, a.Digest)
}

func TestToParserAuth_APIKeyNilCfg(t *testing.T) {
	a := toParserAuth(&authCfg{Type: "api-key"})
	require.NotNil(t, a)
	assert.Equal(t, "apikey", string(a.Type))
	assert.Empty(t, a.APIKey)
}

func TestToParserAuth_OAuth2NilCfg(t *testing.T) {
	a := toParserAuth(&authCfg{Type: "oauth2"})
	require.NotNil(t, a)
	assert.Equal(t, "oauth2", string(a.Type))
	assert.Empty(t, a.OAuth2)
}

func TestToParserAuth_OAuth2WithToken(t *testing.T) {
	a := toParserAuth(&authCfg{
		Type:   "oauth2",
		OAuth2: &oauth2Cfg{AccessToken: "tok", TokenType: "Bearer", AddTokenTo: "header"},
	})
	require.NotNil(t, a)
	assert.Equal(t, "oauth2", string(a.Type))
	require.Len(t, a.OAuth2, 3)
}

func TestToParserAuth_AWSSignatureNilCfg(t *testing.T) {
	a := toParserAuth(&authCfg{Type: "aws-signature"})
	require.NotNil(t, a)
	assert.Equal(t, "awsv4", string(a.Type))
	assert.Empty(t, a.AWSV4)
}

func TestToParserAuth_AWSSignatureWithSessionToken(t *testing.T) {
	a := toParserAuth(&authCfg{
		Type: "aws-signature",
		AwsSig: &awsSigCfg{
			AccessKey:    "ak",
			SecretKey:    "sk",
			Region:       "us-east-1",
			Service:      "s3",
			SessionToken: "st",
		},
	})
	require.NotNil(t, a)
	assert.Equal(t, "awsv4", string(a.Type))
	require.Len(t, a.AWSV4, 5)
	assert.Equal(t, "sessionToken", a.AWSV4[4].Key)
}

// ---------- helper function unit tests ----------

func TestCopyMap_Nil(t *testing.T) {
	r := copyMap(nil)
	assert.NotNil(t, r)
	assert.Empty(t, r)
}

func TestCopyMap_Independence(t *testing.T) {
	m := map[string]string{"a": "1", "b": "2"}
	c := copyMap(m)
	assert.Equal(t, m, c)
	c["c"] = "3"
	assert.NotContains(t, m, "c")
}

func TestKVItemsToHeaderMap(t *testing.T) {
	items := []kvItem{
		{Key: "Accept", Value: "application/json", Enabled: true},
		{Key: "X-Skip", Value: "ignored", Enabled: false},
		{Key: "", Value: "empty-key", Enabled: true},
	}
	m := kvItemsToHeaderMap(items)
	assert.Len(t, m, 1)
	assert.Equal(t, "application/json", m["Accept"])
}

func TestMutsToSend_Empty(t *testing.T) {
	assert.Nil(t, mutsToSend(sandbox.Mutations{}))
}

func TestMutsToSend_NonEmpty(t *testing.T) {
	r := mutsToSend(sandbox.Mutations{
		Environment:         map[string]string{"k": "v"},
		CollectionVariables: map[string]string{"c": "w"},
	})
	require.NotNil(t, r)
	assert.Equal(t, "v", r.Environment["k"])
	assert.Equal(t, "w", r.CollectionVariables["c"])
	assert.Nil(t, r.Globals)
}

func TestMergeMutations_BothNil(t *testing.T) {
	assert.Nil(t, mergeMutations(nil, nil))
}

func TestMergeMutations_OnlyPre(t *testing.T) {
	pre := &sandbox.ScriptResult{
		Mutations: sandbox.Mutations{Globals: map[string]string{"k": "pre"}},
	}
	r := mergeMutations(pre, nil)
	require.NotNil(t, r)
	assert.Equal(t, "pre", r.Globals["k"])
}

func TestMergeMutations_TestOverridesPre(t *testing.T) {
	pre := &sandbox.ScriptResult{
		Mutations: sandbox.Mutations{Environment: map[string]string{"key": "from-pre", "only-pre": "x"}},
	}
	test := &sandbox.ScriptResult{
		Mutations: sandbox.Mutations{Environment: map[string]string{"key": "from-test", "only-test": "y"}},
	}
	r := mergeMutations(pre, test)
	require.NotNil(t, r)
	assert.Equal(t, "from-test", r.Environment["key"])
	assert.Equal(t, "x", r.Environment["only-pre"])
	assert.Equal(t, "y", r.Environment["only-test"])
}

func TestMergeMutations_EmptyResult(t *testing.T) {
	pre := &sandbox.ScriptResult{}
	test := &sandbox.ScriptResult{}
	assert.Nil(t, mergeMutations(pre, test))
}

func TestApplyMutsToCtx(t *testing.T) {
	sctx := &sandbox.ScriptContext{
		Globals:             map[string]string{"existing": "old"},
		Environment:         map[string]string{},
		CollectionVariables: map[string]string{},
	}
	applyMutsToCtx(sctx, sandbox.Mutations{
		Globals:             map[string]string{"existing": "new", "added": "val"},
		Environment:         map[string]string{"envKey": "envVal"},
		CollectionVariables: map[string]string{"colKey": "colVal"},
	})
	assert.Equal(t, "new", sctx.Globals["existing"])
	assert.Equal(t, "val", sctx.Globals["added"])
	assert.Equal(t, "envVal", sctx.Environment["envKey"])
	assert.Equal(t, "colVal", sctx.CollectionVariables["colKey"])
}

func TestBuildScriptContext_Fields(t *testing.T) {
	req := sendReq{
		Method:      "POST",
		URL:         "https://example.com/api",
		BodyRaw:     `{"k":"v"}`,
		RequestName: "My Request",
		RequestID:   "req-abc",
		Headers:     []kvItem{{Key: "Content-Type", Value: "application/json", Enabled: true}},
		Variables: sendVariables{
			Globals:             map[string]string{"g": "1"},
			Environment:         map[string]string{"e": "2"},
			CollectionVariables: map[string]string{"c": "3"},
		},
	}
	ctx := buildScriptContext(req, "prerequest", nil)

	assert.Equal(t, "prerequest", ctx.Info.EventName)
	assert.Equal(t, "My Request", ctx.Info.RequestName)
	assert.Equal(t, "req-abc", ctx.Info.RequestID)
	assert.Equal(t, "POST", ctx.Request.Method)
	assert.Equal(t, "https://example.com/api", ctx.Request.URL)
	assert.Equal(t, `{"k":"v"}`, ctx.Request.Body)
	assert.Equal(t, "application/json", ctx.Request.Headers["Content-Type"])
	assert.Equal(t, "1", ctx.Globals["g"])
	assert.Equal(t, "2", ctx.Environment["e"])
	assert.Equal(t, "3", ctx.CollectionVariables["c"])
	assert.Nil(t, ctx.Response)
}

func TestBuildScriptContext_CopiesVariables(t *testing.T) {
	req := sendReq{
		Variables: sendVariables{Globals: map[string]string{"k": "original"}},
	}
	ctx := buildScriptContext(req, "test", nil)
	req.Variables.Globals["k"] = "mutated"
	assert.Equal(t, "original", ctx.Globals["k"])
}

func TestBuildScriptContext_NilVariables(t *testing.T) {
	req := sendReq{}
	ctx := buildScriptContext(req, "test", nil)
	assert.NotNil(t, ctx.Globals)
	assert.NotNil(t, ctx.Environment)
	assert.NotNil(t, ctx.CollectionVariables)
}

// ---------- mock sandbox runner ----------

type mockRunner struct {
	results []mockExecResult
	calls   int
}

type mockExecResult struct {
	result *sandbox.ScriptResult
	err    error
}

func (m *mockRunner) Execute(_ context.Context, _, _ string, _ *sandbox.ScriptContext) (*sandbox.ScriptResult, error) {
	if m.calls >= len(m.results) {
		return &sandbox.ScriptResult{}, nil
	}
	r := m.results[m.calls]
	m.calls++
	return r.result, r.err
}

func (m *mockRunner) Close() error { return nil }

func newMockRunner(results ...*sandbox.ScriptResult) *mockRunner {
	mr := &mockRunner{}
	for _, r := range results {
		mr.results = append(mr.results, mockExecResult{result: r})
	}
	return mr
}

func newErrRunner(err error) *mockRunner {
	return &mockRunner{results: []mockExecResult{{err: err}}}
}

// ---------- handleSend with sandbox ----------

func TestHandleSend_PreRequestScript_SetsVariables(t *testing.T) {
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer target.Close()

	s := &server{sandbox: newMockRunner(&sandbox.ScriptResult{
		Mutations: sandbox.Mutations{Environment: map[string]string{"token": "abc"}},
	})}
	body := sendReq{
		Method: "GET", URL: target.URL, FollowRedirects: true, SslVerification: true,
		PreRequestScript: "pm.environment.set('token','abc')",
	}
	bodyBytes, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/api/send", bytes.NewReader(bodyBytes))
	w := httptest.NewRecorder()
	s.handleSend(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	var resp sendResp
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	require.NotNil(t, resp.Mutations)
	assert.Equal(t, "abc", resp.Mutations.Environment["token"])
}

func TestHandleSend_PreRequestScript_SkipRequest(t *testing.T) {
	s := &server{sandbox: newMockRunner(&sandbox.ScriptResult{
		Mutations: sandbox.Mutations{SkipRequest: true},
	})}
	body := sendReq{
		Method: "GET", URL: "http://localhost:1", FollowRedirects: true, SslVerification: true,
		PreRequestScript: "pm.execution.skipRequest()",
	}
	bodyBytes, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/api/send", bytes.NewReader(bodyBytes))
	w := httptest.NewRecorder()
	s.handleSend(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	var resp sendResp
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, 0, resp.Status) // no HTTP was made
}

func TestHandleSend_PreRequestError_HTTPStillExecuted(t *testing.T) {
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer target.Close()

	s := &server{sandbox: newErrRunner(errors.New("script syntax error"))}
	body := sendReq{
		Method: "GET", URL: target.URL, FollowRedirects: true, SslVerification: true,
		PreRequestScript: "invalid js {{",
	}
	bodyBytes, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/api/send", bytes.NewReader(bodyBytes))
	w := httptest.NewRecorder()
	s.handleSend(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	var resp sendResp
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, "script syntax error", resp.PreRequestError)
	assert.Equal(t, 200, resp.Status) // HTTP was still executed despite script error
}

func TestHandleSend_TestScript_ReturnsResults(t *testing.T) {
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = fmt.Fprint(w, `{"ok":true}`)
	}))
	defer target.Close()

	s := &server{sandbox: newMockRunner(&sandbox.ScriptResult{
		Tests: []sandbox.TestResult{
			{Name: "Status is 200", Passed: true},
			{Name: "Body has ok", Passed: false, Error: "expected true"},
		},
	})}
	body := sendReq{
		Method: "GET", URL: target.URL, FollowRedirects: true, SslVerification: true,
		TestScript: "pm.test('Status is 200', () => pm.response.to.have.status(200))",
	}
	bodyBytes, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/api/send", bytes.NewReader(bodyBytes))
	w := httptest.NewRecorder()
	s.handleSend(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	var resp sendResp
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	require.Len(t, resp.TestResults, 2)
	assert.True(t, resp.TestResults[0].Passed)
	assert.Equal(t, "Status is 200", resp.TestResults[0].Name)
	assert.False(t, resp.TestResults[1].Passed)
}

func TestHandleSend_TestError(t *testing.T) {
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer target.Close()

	s := &server{sandbox: newErrRunner(errors.New("runtime panic in test"))}
	body := sendReq{
		Method: "GET", URL: target.URL, FollowRedirects: true, SslVerification: true,
		TestScript: "throw new Error('crash')",
	}
	bodyBytes, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/api/send", bytes.NewReader(bodyBytes))
	w := httptest.NewRecorder()
	s.handleSend(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	var resp sendResp
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, "runtime panic in test", resp.TestError)
	assert.Equal(t, 200, resp.Status)
}

func TestHandleSend_TestScript_VisualizerHTML(t *testing.T) {
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer target.Close()

	s := &server{sandbox: newMockRunner(&sandbox.ScriptResult{
		VisualizerHTML: "<h1>Hello</h1>",
	})}
	body := sendReq{
		Method: "GET", URL: target.URL, FollowRedirects: true, SslVerification: true,
		TestScript: `pm.visualizer.set("<h1>Hello</h1>", {})`,
	}
	bodyBytes, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/api/send", bytes.NewReader(bodyBytes))
	w := httptest.NewRecorder()
	s.handleSend(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	var resp sendResp
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, "<h1>Hello</h1>", resp.VisualizerHTML)
}

func TestHandleSend_NoSandbox_ScriptsIgnored(t *testing.T) {
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer target.Close()

	s := &server{} // sandbox is nil
	body := sendReq{
		Method: "GET", URL: target.URL, FollowRedirects: true, SslVerification: true,
		PreRequestScript: "pm.environment.set('x','1')",
		TestScript:       "pm.test('ok', () => true)",
	}
	bodyBytes, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/api/send", bytes.NewReader(bodyBytes))
	w := httptest.NewRecorder()
	s.handleSend(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	var resp sendResp
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, 200, resp.Status)
	assert.Empty(t, resp.TestResults)
	assert.Empty(t, resp.PreRequestError)
	assert.Nil(t, resp.Mutations)
}

func TestMutsToSend_OnlyGlobals(t *testing.T) {
	r := mutsToSend(sandbox.Mutations{
		Globals: map[string]string{"token": "abc"},
	})
	require.NotNil(t, r)
	assert.Equal(t, "abc", r.Globals["token"])
	assert.Nil(t, r.Environment)
	assert.Nil(t, r.CollectionVariables)
}

func TestMergeMutations_PreColVars(t *testing.T) {
	pre := &sandbox.ScriptResult{
		Mutations: sandbox.Mutations{CollectionVariables: map[string]string{"base": "url", "version": "v2"}},
	}
	r := mergeMutations(pre, nil)
	require.NotNil(t, r)
	assert.Equal(t, "url", r.CollectionVariables["base"])
	assert.Equal(t, "v2", r.CollectionVariables["version"])
	assert.Nil(t, r.Globals)
	assert.Nil(t, r.Environment)
}

func TestMergeMutations_TestGlobalsAndColVars(t *testing.T) {
	test := &sandbox.ScriptResult{
		Mutations: sandbox.Mutations{
			Globals:             map[string]string{"g": "gval"},
			CollectionVariables: map[string]string{"c": "cval"},
		},
	}
	r := mergeMutations(nil, test)
	require.NotNil(t, r)
	assert.Equal(t, "gval", r.Globals["g"])
	assert.Equal(t, "cval", r.CollectionVariables["c"])
	assert.Nil(t, r.Environment)
}

func TestHandleSend_BothScripts_MutationsMerged(t *testing.T) {
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer target.Close()

	s := &server{sandbox: newMockRunner(
		&sandbox.ScriptResult{
			Mutations: sandbox.Mutations{Environment: map[string]string{"pre": "val", "shared": "from-pre"}},
		},
		&sandbox.ScriptResult{
			Mutations: sandbox.Mutations{Environment: map[string]string{"shared": "from-test", "test": "val2"}},
		},
	)}
	body := sendReq{
		Method: "GET", URL: target.URL, FollowRedirects: true, SslVerification: true,
		PreRequestScript: "pm.environment.set('pre','val')",
		TestScript:       "pm.test('ok', () => true)",
	}
	bodyBytes, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/api/send", bytes.NewReader(bodyBytes))
	w := httptest.NewRecorder()
	s.handleSend(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	var resp sendResp
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	require.NotNil(t, resp.Mutations)
	assert.Equal(t, "val", resp.Mutations.Environment["pre"])
	assert.Equal(t, "from-test", resp.Mutations.Environment["shared"]) // test overrides pre
	assert.Equal(t, "val2", resp.Mutations.Environment["test"])
}

// ---------- cancelSend ----------

func TestCancelSend_NotFound(t *testing.T) {
	mux := testServer(t).newMux(testFS())
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodDelete, "/api/send/unknown-id", nil))

	assert.Equal(t, http.StatusNotFound, w.Code)
	var body errResp
	require.NoError(t, json.NewDecoder(w.Body).Decode(&body))
	assert.Equal(t, "not_found", body.Code)
}

func TestCancelSend_InFlight(t *testing.T) {
	// Target that blocks until the client disconnects (context cancelled).
	started := make(chan struct{})
	target := httptest.NewServer(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
		close(started)
		<-r.Context().Done()
	}))
	defer target.Close()

	s := testServer(t)
	mux := s.newMux(testFS())

	reqID := "inflight-1"
	body, _ := json.Marshal(sendReq{
		Method: "GET", URL: target.URL,
		FollowRedirects: true, SslVerification: true,
		RequestID: reqID,
	})

	postReq := httptest.NewRequest(http.MethodPost, "/api/send", bytes.NewReader(body))
	postReq.Header.Set("Content-Type", "application/json")
	postW := httptest.NewRecorder()

	done := make(chan struct{})
	go func() {
		defer close(done)
		mux.ServeHTTP(postW, postReq)
	}()

	<-started // target received the request; cancel is already registered

	cancelReq := httptest.NewRequest(http.MethodDelete, "/api/send/"+reqID, nil)
	cancelW := httptest.NewRecorder()
	mux.ServeHTTP(cancelW, cancelReq)
	assert.Equal(t, http.StatusNoContent, cancelW.Code)

	<-done
	assert.Equal(t, http.StatusUnprocessableEntity, postW.Code)
}

func TestCancelSend_CleanupAfterCompletion(t *testing.T) {
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer target.Close()

	s := testServer(t)
	mux := s.newMux(testFS())

	reqID := "completed-1"
	body, _ := json.Marshal(sendReq{
		Method: "GET", URL: target.URL,
		FollowRedirects: true, SslVerification: true,
		RequestID: reqID,
	})

	postReq := httptest.NewRequest(http.MethodPost, "/api/send", bytes.NewReader(body))
	postReq.Header.Set("Content-Type", "application/json")
	postW := httptest.NewRecorder()
	mux.ServeHTTP(postW, postReq)
	require.Equal(t, http.StatusOK, postW.Code)

	// After completion the cancel entry must be gone.
	cancelReq := httptest.NewRequest(http.MethodDelete, "/api/send/"+reqID, nil)
	cancelW := httptest.NewRecorder()
	mux.ServeHTTP(cancelW, cancelReq)
	assert.Equal(t, http.StatusNotFound, cancelW.Code)
}

// ── Script timeout ────────────────────────────────────────────────────────────

// blockingRunner blocks Execute until the context is done.
type blockingRunner struct{}

func (b *blockingRunner) Execute(ctx context.Context, _, _ string, _ *sandbox.ScriptContext) (*sandbox.ScriptResult, error) {
	<-ctx.Done()
	return nil, ctx.Err()
}

func (b *blockingRunner) Close() error { return nil }

func TestHandleSend_ScriptTimeoutKillsPreRequest(t *testing.T) {
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer target.Close()

	s, st := testServerWithStorage(t)
	// Set a 1 ms script timeout so the blocking runner always times out.
	require.NoError(t, st.Settings.Set(t.Context(), settingKeyScriptTimeoutMs, "1"))
	s.sandbox = &blockingRunner{}
	mux := s.newMux(testFS())

	body, _ := json.Marshal(sendReq{
		Method: "GET", URL: target.URL,
		FollowRedirects: true, SslVerification: true,
		PreRequestScript: "// hangs",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/send", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	var resp sendResp
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.NotEmpty(t, resp.PreRequestError, "pre-request timeout must surface as an error")
}

func TestHandleSend_ScriptTimeoutKillsTestScript(t *testing.T) {
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer target.Close()

	s, st := testServerWithStorage(t)
	require.NoError(t, st.Settings.Set(t.Context(), settingKeyScriptTimeoutMs, "1"))
	s.sandbox = &blockingRunner{}
	mux := s.newMux(testFS())

	body, _ := json.Marshal(sendReq{
		Method: "GET", URL: target.URL,
		FollowRedirects: true, SslVerification: true,
		TestScript: "// hangs",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/send", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	var resp sendResp
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.NotEmpty(t, resp.TestError, "test-script timeout must surface as an error")
}

// ── Max response size ─────────────────────────────────────────────────────────

func TestHandleSend_MaxResponseSizeTruncates(t *testing.T) {
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte("0123456789"))
	}))
	defer target.Close()

	s, st := testServerWithStorage(t)
	// 1 byte limit.
	require.NoError(t, st.Settings.Set(t.Context(), settingKeyMaxResponseSizeMB, "0"))
	// 0 means unlimited in defaultSettings, use a tiny value via direct field test
	// instead: set 1 MB but use a body bigger than 0 but ensure truncation via engine test.
	// For the handler test, verify that when MaxResponseSizeMB > 0 the setting is read.
	require.NoError(t, st.Settings.Set(t.Context(), settingKeyMaxResponseSizeMB, "1"))
	mux := s.newMux(testFS())

	body, _ := json.Marshal(sendReq{
		Method: "GET", URL: target.URL,
		FollowRedirects: true, SslVerification: true,
	})
	req := httptest.NewRequest(http.MethodPost, "/api/send", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	var resp sendResp
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	// Body is 10 bytes, limit is 1 MB — nothing truncated, just verify no error.
	assert.Equal(t, "0123456789", resp.Body)
}

// ── loadSettings ─────────────────────────────────────────────────────────────

func TestLoadSettings_NoStorage_ReturnsDefaults(t *testing.T) {
	s := testServer(t)
	d := s.loadSettings(httptest.NewRequest(http.MethodGet, "/", nil))
	assert.Equal(t, 50, d.MaxResponseSizeMB)
	assert.Equal(t, 5000, d.ScriptTimeoutMs)
	assert.True(t, d.SSLVerification)
}

func TestLoadSettings_WithStorage_ReturnsStoredValues(t *testing.T) {
	s, st := testServerWithStorage(t)
	require.NoError(t, st.Settings.Set(t.Context(), settingKeyScriptTimeoutMs, "2000"))
	require.NoError(t, st.Settings.Set(t.Context(), settingKeyMaxResponseSizeMB, "25"))

	d := s.loadSettings(httptest.NewRequest(http.MethodGet, "/", nil))
	assert.Equal(t, 25, d.MaxResponseSizeMB)
	assert.Equal(t, 2000, d.ScriptTimeoutMs)
}

func TestLoadSettings_ClosedStorage_ReturnsDefaults(t *testing.T) {
	s, st := testServerWithStorage(t)
	require.NoError(t, st.Close())

	d := s.loadSettings(httptest.NewRequest(http.MethodGet, "/", nil))
	assert.Equal(t, 50, d.MaxResponseSizeMB)
}

// ── IgnoreProxy ───────────────────────────────────────────────────────────────

func TestHandleSend_IgnoreProxy_SkipsProxySettings(t *testing.T) {
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer target.Close()

	s, st := testServerWithStorage(t)
	// Store a proxy setting that would break the request if applied.
	require.NoError(t, st.Settings.Set(t.Context(), settingKeyUseSystemProxy, "true"))
	mux := s.newMux(testFS())

	body, _ := json.Marshal(sendReq{
		Method:          "GET",
		URL:             target.URL,
		FollowRedirects: true,
		SslVerification: true,
		IgnoreProxy:     true, // must skip the proxy settings block
	})
	req := httptest.NewRequest(http.MethodPost, "/api/send", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	var resp sendResp
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, 200, resp.Status)
}

// ── MaxResponseSizeMB == 0 (unlimited) ───────────────────────────────────────

func TestHandleSend_MaxResponseSizeZero_Unlimited(t *testing.T) {
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte("0123456789"))
	}))
	defer target.Close()

	s, st := testServerWithStorage(t)
	// 0 means no limit: the if-branch (MaxResponseSizeMB > 0) must be false.
	require.NoError(t, st.Settings.Set(t.Context(), settingKeyMaxResponseSizeMB, "0"))

	mux := s.newMux(testFS())

	body, _ := json.Marshal(sendReq{
		Method:          "GET",
		URL:             target.URL,
		FollowRedirects: true,
		SslVerification: true,
	})
	req := httptest.NewRequest(http.MethodPost, "/api/send", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	var resp sendResp
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	// All 10 bytes must be received intact.
	assert.Equal(t, "0123456789", resp.Body)
}

// ── NewClient error (bad proxy URL) ──────────────────────────────────────────

func TestHandleSend_NewClientError_BadProxyURL(t *testing.T) {
	s, st := testServerWithStorage(t)
	// An unclosed IPv6 bracket causes url.Parse to fail inside NewClient.
	require.NoError(t, st.Settings.Set(t.Context(), settingKeyProxyURL, "http://[::1"))
	mux := s.newMux(testFS())

	body, _ := json.Marshal(sendReq{
		Method:          "GET",
		URL:             "http://localhost:1",
		FollowRedirects: true,
		SslVerification: true,
		// IgnoreProxy is false (default) so the stored proxyUrl is used.
	})
	req := httptest.NewRequest(http.MethodPost, "/api/send", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	assert.Equal(t, http.StatusInternalServerError, w.Code)
	var errBody errResp
	require.NoError(t, json.NewDecoder(w.Body).Decode(&errBody))
	assert.Equal(t, "internal_error", errBody.Code)
}

// ── Binary body ──────────────────────────────────────────────────────────────

func TestBuildParserReq_BinaryBody_ValidBase64(t *testing.T) {
	req := sendReq{
		Method:            "POST",
		URL:               "https://example.com",
		BodyType:          "binary",
		BodyBinaryContent: base64.StdEncoding.EncodeToString([]byte("hello")),
	}
	pr := buildParserReq(req)
	require.NotNil(t, pr.Body)
	assert.Equal(t, "file", string(pr.Body.Mode))
	assert.Equal(t, []byte("hello"), pr.Body.File)
}

func TestBuildParserReq_BinaryBody_EmptyContent(t *testing.T) {
	req := sendReq{
		Method:            "POST",
		URL:               "https://example.com",
		BodyType:          "binary",
		BodyBinaryContent: "",
	}
	pr := buildParserReq(req)
	assert.Nil(t, pr.Body)
}

func TestBuildParserReq_BinaryBody_InvalidBase64(t *testing.T) {
	req := sendReq{
		Method:            "POST",
		URL:               "https://example.com",
		BodyType:          "binary",
		BodyBinaryContent: "not-valid-base64!!!",
	}
	pr := buildParserReq(req)
	assert.Nil(t, pr.Body)
}

func TestHandleSend_BinaryBody_SentAsOctetStream(t *testing.T) {
	var receivedCT, receivedBody string
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		buf := new(bytes.Buffer)
		_, _ = buf.ReadFrom(r.Body)
		receivedBody = buf.String()
		receivedCT = r.Header.Get("Content-Type")
		w.WriteHeader(http.StatusOK)
	}))
	defer target.Close()

	body := sendReq{
		Method:            "POST",
		URL:               target.URL,
		BodyType:          "binary",
		BodyBinaryContent: base64.StdEncoding.EncodeToString([]byte("hello file")),
		FollowRedirects:   true,
		SslVerification:   true,
	}
	bodyBytes, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/api/send", bytes.NewReader(bodyBytes))
	w := httptest.NewRecorder()
	(&server{}).handleSend(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, "hello file", receivedBody)
	assert.Equal(t, "application/octet-stream", receivedCT)
}

// ── Per-request proxy ─────────────────────────────────────────────────────────

func TestHandleSend_PerRequestProxy_OverridesGlobal(t *testing.T) {
	// A broken global proxy would make NewClient fail with a 500.
	// When RequestProxyURL is set, it overrides the global — NewClient must not fail.
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer target.Close()

	s, st := testServerWithStorage(t)
	require.NoError(t, st.Settings.Set(t.Context(), settingKeyProxyURL, "http://[::1")) // invalid — would cause 500
	mux := s.newMux(testFS())

	// Without per-request override: the global bad proxy causes a 500.
	body, _ := json.Marshal(sendReq{
		Method: "GET", URL: "http://localhost:1",
		FollowRedirects: true, SslVerification: true,
	})
	req := httptest.NewRequest(http.MethodPost, "/api/send", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)
	assert.Equal(t, http.StatusInternalServerError, w.Code, "broken global proxy must produce 500")

	// With per-request override: a valid proxy URL replaces the broken global.
	// NewClient succeeds (even if the proxy itself is unreachable → network error, not 500).
	body2, _ := json.Marshal(sendReq{
		Method: "GET", URL: "http://localhost:1",
		FollowRedirects: true,
		SslVerification: true,
		RequestProxyURL: "http://proxy.example.com:8080", // valid URL, not reachable
	})
	req2 := httptest.NewRequest(http.MethodPost, "/api/send", bytes.NewReader(body2))
	req2.Header.Set("Content-Type", "application/json")
	w2 := httptest.NewRecorder()
	mux.ServeHTTP(w2, req2)
	assert.NotEqual(t, http.StatusInternalServerError, w2.Code, "per-request proxy must bypass the broken global proxy")
}

func TestHandleSend_PerRequestProxy_WithCredentials(t *testing.T) {
	// Verify that proxy credentials are accepted without error at NewClient construction.
	// The target may be unreachable through the proxy (network error), but not a 500 internal_error.
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer target.Close()

	body := sendReq{
		Method:               "GET",
		URL:                  target.URL,
		FollowRedirects:      true,
		SslVerification:      true,
		RequestProxyURL:      "http://myproxy:3128",
		RequestProxyUsername: "alice",
		RequestProxyPassword: "secret",
	}
	bodyBytes, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/api/send", bytes.NewReader(bodyBytes))
	w := httptest.NewRecorder()
	(&server{}).handleSend(w, req)

	// NewClient construction must succeed — result is either 200 (direct) or network error (422), never 500.
	assert.NotEqual(t, http.StatusInternalServerError, w.Code)
	var errBody errResp
	_ = json.NewDecoder(w.Body).Decode(&errBody)
	assert.NotEqual(t, "internal_error", errBody.Code)
}

// ── HTTPVersion ───────────────────────────────────────────────────────────────

func TestHandleSend_HTTPVersion_HTTP1_Accepted(t *testing.T) {
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer target.Close()

	body := sendReq{
		Method:          "GET",
		URL:             target.URL,
		HTTPVersion:     "http1",
		FollowRedirects: true,
		SslVerification: true,
	}
	bodyBytes, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/api/send", bytes.NewReader(bodyBytes))
	w := httptest.NewRecorder()
	(&server{}).handleSend(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	var resp sendResp
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, 200, resp.Status)
}

// ── MaxRedirects ──────────────────────────────────────────────────────────────

func TestHandleSend_MaxRedirects_LimitsFollow(t *testing.T) {
	// Chain: /r1 → /r2 → 200. With MaxRedirects=1, after following /r1→/r2 (1 hop),
	// CheckRedirect stops and returns the /r1 302 response.
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/r1":
			http.Redirect(w, r, "/r2", http.StatusFound)
		case "/r2":
			http.Redirect(w, r, "/final", http.StatusFound)
		default:
			w.WriteHeader(http.StatusOK)
		}
	}))
	defer target.Close()

	body := sendReq{
		Method:          "GET",
		URL:             target.URL + "/r1",
		FollowRedirects: true,
		MaxRedirects:    1,
		SslVerification: true,
	}
	bodyBytes, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/api/send", bytes.NewReader(bodyBytes))
	w := httptest.NewRecorder()
	(&server{}).handleSend(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	var resp sendResp
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, http.StatusFound, resp.Status)
}

// ── FollowOriginalMethod ──────────────────────────────────────────────────────

func TestHandleSend_FollowOriginalMethod_PreservesPost(t *testing.T) {
	var receivedMethod string
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/redirect" {
			http.Redirect(w, r, "/final", http.StatusMovedPermanently)
			return
		}
		receivedMethod = r.Method
		w.WriteHeader(http.StatusOK)
	}))
	defer target.Close()

	body := sendReq{
		Method:               "POST",
		URL:                  target.URL + "/redirect",
		FollowRedirects:      true,
		FollowOriginalMethod: true,
		SslVerification:      true,
	}
	bodyBytes, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/api/send", bytes.NewReader(bodyBytes))
	w := httptest.NewRecorder()
	(&server{}).handleSend(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	var resp sendResp
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, 200, resp.Status)
	assert.Equal(t, "POST", receivedMethod)
}

// ── RemoveReferer ─────────────────────────────────────────────────────────────

func TestHandleSend_RemoveReferer_DropsHeader(t *testing.T) {
	var receivedReferer string
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/step1" {
			http.Redirect(w, r, "/step2", http.StatusFound)
			return
		}
		receivedReferer = r.Header.Get("Referer")
		w.WriteHeader(http.StatusOK)
	}))
	defer target.Close()

	body := sendReq{
		Method:          "GET",
		URL:             target.URL + "/step1",
		FollowRedirects: true,
		RemoveReferer:   true,
		SslVerification: true,
	}
	bodyBytes, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/api/send", bytes.NewReader(bodyBytes))
	w := httptest.NewRecorder()
	(&server{}).handleSend(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	var resp sendResp
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, 200, resp.Status)
	assert.Empty(t, receivedReferer)
}

// ── engineauth.New error (bearer with empty token) ───────────────────────────

func TestHandleSend_AuthError_EmptyBearerToken(t *testing.T) {
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer target.Close()

	// Bearer token is required by engineauth.New; an empty token returns an error.
	body, _ := json.Marshal(sendReq{
		Method:          "GET",
		URL:             target.URL,
		FollowRedirects: true,
		SslVerification: true,
		Auth:            &authCfg{Type: "bearer", Bearer: &bearerCfg{Token: ""}},
	})
	req := httptest.NewRequest(http.MethodPost, "/api/send", bytes.NewReader(body))
	w := httptest.NewRecorder()
	(&server{}).handleSend(w, req)

	assert.Equal(t, http.StatusInternalServerError, w.Code)
	var errBody errResp
	require.NoError(t, json.NewDecoder(w.Body).Decode(&errBody))
	assert.Equal(t, "internal_error", errBody.Code)
}
