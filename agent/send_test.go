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
