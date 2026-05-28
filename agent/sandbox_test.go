package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/guillaumedelre/reqlet/engine/sandbox"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestHandleSandboxRun_NoSandbox(t *testing.T) {
	s := &server{}
	mux := s.newMux(testFS())
	body, _ := json.Marshal(sandboxRunReq{Script: "pm.test('ok', () => true)", Event: "test"})
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/api/sandbox/run", bytes.NewReader(body)))
	assert.Equal(t, http.StatusServiceUnavailable, w.Code)
	var resp errResp
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, "sandbox_unavailable", resp.Code)
}

func TestHandleSandboxRun_InvalidBody(t *testing.T) {
	s := &server{sandbox: newMockRunner()}
	mux := s.newMux(testFS())
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/api/sandbox/run",
		bytes.NewReader([]byte("not json"))))
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestHandleSandboxRun_EmptyScript(t *testing.T) {
	s := &server{sandbox: newMockRunner()}
	mux := s.newMux(testFS())
	body, _ := json.Marshal(sandboxRunReq{Event: "test"})
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/api/sandbox/run", bytes.NewReader(body)))
	assert.Equal(t, http.StatusBadRequest, w.Code)
	var resp errResp
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Contains(t, resp.Error, "script is required")
}

func TestHandleSandboxRun_SandboxError(t *testing.T) {
	s := &server{sandbox: newErrRunner(errors.New("syntax error"))}
	mux := s.newMux(testFS())
	body, _ := json.Marshal(sandboxRunReq{Script: "{{invalid", Event: "prerequest"})
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/api/sandbox/run", bytes.NewReader(body)))
	assert.Equal(t, http.StatusOK, w.Code)
	var resp sandboxRunResp
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Contains(t, resp.Error, "syntax error")
	assert.Empty(t, resp.Tests)
}

func TestHandleSandboxRun_Success(t *testing.T) {
	s := &server{sandbox: newMockRunner(&sandbox.ScriptResult{
		Tests: []sandbox.TestResult{{Name: "status is 200", Passed: true}},
		Mutations: sandbox.Mutations{
			Environment: map[string]string{"token": "abc"},
		},
	})}
	mux := s.newMux(testFS())
	body, _ := json.Marshal(sandboxRunReq{
		Script:    "pm.test('status is 200', () => pm.response.to.have.status(200))",
		Event:     "test",
		Variables: sendVariables{Environment: map[string]string{"base_url": "http://api.example.com"}},
	})
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/api/sandbox/run", bytes.NewReader(body)))
	require.Equal(t, http.StatusOK, w.Code)
	var resp sandboxRunResp
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	require.Len(t, resp.Tests, 1)
	assert.True(t, resp.Tests[0].Passed)
	require.NotNil(t, resp.Mutations)
	assert.Equal(t, "abc", resp.Mutations.Environment["token"])
}

func TestHandleSandboxRun_DefaultEvent(t *testing.T) {
	s := &server{sandbox: newMockRunner(&sandbox.ScriptResult{})}
	mux := s.newMux(testFS())
	body, _ := json.Marshal(sandboxRunReq{Script: "console.log('hi')"})
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/api/sandbox/run", bytes.NewReader(body)))
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestHandleSandboxRun_WithResponse(t *testing.T) {
	s := &server{sandbox: newMockRunner(&sandbox.ScriptResult{
		Tests: []sandbox.TestResult{{Name: "check body", Passed: true}},
	})}
	mux := s.newMux(testFS())
	body, _ := json.Marshal(sandboxRunReq{
		Script: "pm.test('check body', () => pm.response.to.have.status(200))",
		Event:  "test",
		Response: &sandbox.ResponseInfo{
			Status: "OK", Code: 200, ResponseTime: 50, Body: `{"ok":true}`,
		},
	})
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/api/sandbox/run", bytes.NewReader(body)))
	require.Equal(t, http.StatusOK, w.Code)
	var resp sandboxRunResp
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	require.Len(t, resp.Tests, 1)
	assert.Equal(t, "check body", resp.Tests[0].Name)
}
