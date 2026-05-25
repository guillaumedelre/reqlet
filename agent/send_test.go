package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestHandleSend_WrongMethod(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/send", nil)
	w := httptest.NewRecorder()
	handleSend(w, req)
	assert.Equal(t, http.StatusMethodNotAllowed, w.Code)
}

func TestHandleSend_BadJSON(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/api/send", bytes.NewBufferString("not json"))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	handleSend(w, req)
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
	handleSend(w, req)

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
	handleSend(w, req)

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
	handleSend(w, req)

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
	handleSend(w, req)

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
	handleSend(w, req)

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
	handleSend(w, req)

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
	handleSend(w, req)

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
