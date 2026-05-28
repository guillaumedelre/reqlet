package main

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/guillaumedelre/reqlet/engine/sandbox"
)

type sandboxRunReq struct {
	Script    string                `json:"script"`
	Event     string                `json:"event,omitempty"` // "prerequest" | "test"; defaults to "prerequest"
	Variables sendVariables         `json:"variables,omitempty"`
	Request   *sandbox.RequestInfo  `json:"request,omitempty"`
	Response  *sandbox.ResponseInfo `json:"response,omitempty"`
}

type sandboxRunResp struct {
	Tests     []sandbox.TestResult `json:"tests"`
	Mutations *sendMutations       `json:"mutations,omitempty"`
	Error     string               `json:"error,omitempty"`
}

func (s *server) handleSandboxRun(w http.ResponseWriter, r *http.Request) {
	if s.sandbox == nil {
		writeJSON(w, http.StatusServiceUnavailable, errResp{Error: "sandbox not available", Code: "sandbox_unavailable"})
		return
	}

	var req sandboxRunReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, errResp{Error: "invalid request body: " + err.Error(), Code: "bad_request"})
		return
	}

	if req.Script == "" {
		writeJSON(w, http.StatusBadRequest, errResp{Error: "script is required", Code: "bad_request"})
		return
	}

	event := req.Event
	if event == "" {
		event = "prerequest"
	}

	sctx := &sandbox.ScriptContext{
		Globals:             copyMap(req.Variables.Globals),
		Environment:         copyMap(req.Variables.Environment),
		CollectionVariables: copyMap(req.Variables.CollectionVariables),
		IterationData:       map[string]string{},
		Request:             req.Request,
		Response:            req.Response,
		Info:                sandbox.ExecInfo{EventName: event},
	}

	settings := s.loadSettings(r)
	scriptTimeout := time.Duration(settings.ScriptTimeoutMs) * time.Millisecond
	scriptCtx, cancel := context.WithTimeout(r.Context(), scriptTimeout)
	defer cancel()

	result, err := s.sandbox.Execute(scriptCtx, req.Script, event, sctx)
	if err != nil {
		writeJSON(w, http.StatusOK, sandboxRunResp{Error: err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, sandboxRunResp{
		Tests:     result.Tests,
		Mutations: mutsToSend(result.Mutations),
	})
}
