package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"sync"
	"time"

	enginehttp "github.com/guillaumedelre/reqlet/engine/http"
	"github.com/guillaumedelre/reqlet/engine/parser"
	"github.com/guillaumedelre/reqlet/engine/runner"
	"github.com/guillaumedelre/reqlet/engine/sandbox"
)

// ---- request / response types ----

type runVariables struct {
	Globals             map[string]string `json:"globals,omitempty"`
	Environment         map[string]string `json:"environment,omitempty"`
	CollectionVariables map[string]string `json:"collectionVariables,omitempty"`
}

type runReq struct {
	Iterations int           `json:"iterations"`
	DelayMS    int           `json:"delayMs"`
	Bail       bool          `json:"bail"`
	Folder     string        `json:"folder"`
	Variables  *runVariables `json:"variables,omitempty"`
}

type runTestResult struct {
	Name   string `json:"name"`
	Passed bool   `json:"passed"`
	Error  string `json:"error,omitempty"`
}

type runSummary struct {
	RunID        string `json:"runId"`
	CollectionID string `json:"collectionId"`
	StartedAt    string `json:"startedAt"`
	DurationMs   int64  `json:"durationMs"`
	Total        int    `json:"total"`
	Passed       int    `json:"passed"`
	Failed       int    `json:"failed"`
}

type runEvent struct {
	Type       string          `json:"type"`
	Total      int             `json:"total,omitempty"`
	Iterations int             `json:"iterations,omitempty"`
	Iteration  int             `json:"iteration,omitempty"`
	Index      int             `json:"index,omitempty"`
	Name       string          `json:"name,omitempty"`
	Method     string          `json:"method,omitempty"`
	URL        string          `json:"url,omitempty"`
	Status     int             `json:"status,omitempty"`
	DurationMs int64           `json:"durationMs,omitempty"`
	Tests      []runTestResult `json:"tests,omitempty"`
	Passed     bool            `json:"passed"`
	Skipped    bool            `json:"skipped,omitempty"`
	Error      string          `json:"error,omitempty"`
	Summary    *runSummary     `json:"summary,omitempty"`
}

// ---- in-memory run state ----

type runEntry struct {
	mu      sync.Mutex
	events  []runEvent
	ch      chan runEvent
	done    bool
	summary *runSummary
}

func (e *runEntry) appendAndSend(evt runEvent) {
	e.mu.Lock()
	e.events = append(e.events, evt)
	e.mu.Unlock()
	select {
	case e.ch <- evt:
	default:
	}
}

// ---- no-op sandbox for when the Node.js runner is unavailable ----

type noopSandbox struct{}

func (noopSandbox) Execute(_ context.Context, _, _ string, _ *sandbox.ScriptContext) (*sandbox.ScriptResult, error) {
	return &sandbox.ScriptResult{}, nil
}

func (noopSandbox) Close() error { return nil }

// ---- helpers ----

type reqInfoEntry struct {
	method string
	url    string
}

func buildRequestInfoMap(items []parser.Item) map[string]reqInfoEntry {
	m := make(map[string]reqInfoEntry)
	collectReqInfo(items, m)
	return m
}

func collectReqInfo(items []parser.Item, m map[string]reqInfoEntry) {
	for _, item := range items {
		if item.IsFolder() {
			collectReqInfo(item.Item, m)
		} else if item.Request != nil {
			m[item.Name] = reqInfoEntry{
				method: item.Request.Method,
				url:    item.Request.URL.Raw,
			}
		}
	}
}

func countRequests(items []parser.Item) int {
	n := 0
	for _, item := range items {
		if item.IsFolder() {
			n += countRequests(item.Item)
		} else {
			n++
		}
	}
	return n
}

func buildRunSummary(runID, colID string, startedAt time.Time, result *runner.RunResult) runSummary {
	var total, passed, failed int
	for i := range result.Iterations {
		for j := range result.Iterations[i].Requests {
			req := &result.Iterations[i].Requests[j]
			if req.Skipped {
				continue
			}
			total++
			if req.Passed() {
				passed++
			} else {
				failed++
			}
		}
	}
	return runSummary{
		RunID:        runID,
		CollectionID: colID,
		StartedAt:    startedAt.UTC().Format(time.RFC3339),
		DurationMs:   time.Since(startedAt).Milliseconds(),
		Total:        total,
		Passed:       passed,
		Failed:       failed,
	}
}

func writeSSEEvent(w http.ResponseWriter, evt runEvent) {
	data, err := json.Marshal(evt)
	if err != nil {
		return
	}
	_, _ = fmt.Fprintf(w, "data: %s\n\n", data)
}

// ---- handlers ----

func (s *server) handleRunCollection(w http.ResponseWriter, r *http.Request) {
	colID := r.PathValue("id")
	colData, err := s.collections.get(colID)
	if err != nil {
		if errors.Is(err, errNotFound) {
			writeJSON(w, http.StatusNotFound, errResp{Error: "collection not found", Code: "not_found"})
			return
		}
		writeJSON(w, http.StatusInternalServerError, errResp{Error: err.Error(), Code: "internal_error"})
		return
	}

	col, err := CollectionToParser(colData)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, errResp{Error: "parse collection: " + err.Error(), Code: "internal_error"})
		return
	}

	var req runReq
	if decErr := json.NewDecoder(r.Body).Decode(&req); decErr != nil {
		req = runReq{}
	}
	if req.Iterations < 1 {
		req.Iterations = 1
	}

	globalSettings := s.loadSettings(r)
	httpOpts := enginehttp.DefaultOptions()
	httpOpts.Insecure = !globalSettings.SSLVerification
	if globalSettings.MaxResponseSizeMB > 0 {
		httpOpts.MaxBodyBytes = int64(globalSettings.MaxResponseSizeMB) * 1024 * 1024
	}
	if !globalSettings.UseSystemProxy && !globalSettings.RespectEnvProxy && globalSettings.ProxyURL != "" {
		httpOpts.ProxyURL = globalSettings.ProxyURL
	}
	httpOpts.UseSystemProxy = globalSettings.UseSystemProxy
	httpOpts.RespectEnvProxy = globalSettings.RespectEnvProxy

	client, err := enginehttp.NewClient(httpOpts)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, errResp{Error: "build http client: " + err.Error(), Code: "internal_error"})
		return
	}

	var sb sandbox.Runner = noopSandbox{}
	if s.sandbox != nil {
		sb = s.sandbox
	}
	colRunner := runner.New(client, sb)

	runID := newID()
	total := countRequests(col.Item)
	bufSize := max(total*req.Iterations+10, 100)
	entry := &runEntry{ch: make(chan runEvent, bufSize)}
	s.runs.Store(runID, entry)

	startedAt := time.Now()
	iters := req.Iterations
	infoMap := buildRequestInfoMap(col.Item)
	scriptTimeout := time.Duration(globalSettings.ScriptTimeoutMs) * time.Millisecond

	go func() {
		entry.appendAndSend(runEvent{Type: "start", Total: total, Iterations: iters})

		indexPerIter := make([]int, iters)
		var globalVars, envVars, colVars map[string]string
		if req.Variables != nil {
			globalVars = req.Variables.Globals
			envVars = req.Variables.Environment
			colVars = req.Variables.CollectionVariables
		}

		opts := runner.Options{
			Iterations:   iters,
			DelayMS:      req.DelayMS,
			Bail:         req.Bail,
			Folder:       req.Folder,
			SaveResponse: true,
			GlobalVars:   globalVars,
			EnvVars:      envVars,
			ColVars:      colVars,
			OnRequest: func(iterIdx int, result runner.RequestResult) {
				idx := indexPerIter[iterIdx]
				indexPerIter[iterIdx]++

				info := infoMap[result.Name]

				tests := make([]runTestResult, len(result.Tests))
				for i, t := range result.Tests {
					tests[i] = runTestResult{Name: t.Name, Passed: t.Passed, Error: t.Error}
				}

				errStr := ""
				if result.Error != nil {
					errStr = result.Error.Error()
				}

				evt := runEvent{
					Type:      "request",
					Iteration: iterIdx,
					Index:     idx,
					Name:      result.Name,
					Method:    info.method,
					URL:       info.url,
					Tests:     tests,
					Passed:    result.Passed(),
					Skipped:   result.Skipped,
					Error:     errStr,
				}
				if result.Response != nil {
					evt.Status = result.Response.StatusCode
					evt.DurationMs = result.Response.Duration.Milliseconds()
				}
				entry.appendAndSend(evt)
			},
		}
		// script timeout is not directly configurable in runner.Options,
		// but the sandbox honours the context timeout passed per-script inside runner.
		_ = scriptTimeout

		runResult, runErr := colRunner.Run(context.Background(), col, nil, opts)

		if runErr != nil {
			errEvt := runEvent{Type: "error", Error: runErr.Error()}
			entry.appendAndSend(errEvt)
			entry.mu.Lock()
			entry.done = true
			entry.mu.Unlock()
			close(entry.ch)
			return
		}

		summary := buildRunSummary(runID, colID, startedAt, runResult)
		doneEvt := runEvent{Type: "done", Summary: &summary}
		entry.appendAndSend(doneEvt)

		entry.mu.Lock()
		entry.summary = &summary
		entry.done = true
		entry.mu.Unlock()

		close(entry.ch)
	}()

	writeJSON(w, http.StatusAccepted, map[string]string{"runId": runID})
}

func (s *server) handleRunStream(w http.ResponseWriter, r *http.Request) {
	runID := r.PathValue("runId")
	v, ok := s.runs.Load(runID)
	if !ok {
		writeJSON(w, http.StatusNotFound, errResp{Error: "run not found", Code: "not_found"})
		return
	}
	entry := v.(*runEntry)

	// Disable write deadline for long-running SSE connections.
	rc := http.NewResponseController(w)
	_ = rc.SetWriteDeadline(time.Time{})

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	flusher, ok := w.(http.Flusher)
	if !ok {
		writeJSON(w, http.StatusInternalServerError, errResp{Error: "streaming not supported", Code: "internal_error"})
		return
	}

	// If run is already done, replay accumulated events.
	entry.mu.Lock()
	if entry.done {
		evts := make([]runEvent, len(entry.events))
		copy(evts, entry.events)
		entry.mu.Unlock()
		for _, evt := range evts {
			writeSSEEvent(w, evt)
		}
		flusher.Flush()
		return
	}
	entry.mu.Unlock()

	// Live stream: read channel until closed or client disconnects.
	ctx := r.Context()
	for {
		select {
		case evt, ok := <-entry.ch:
			if !ok {
				return
			}
			writeSSEEvent(w, evt)
			flusher.Flush()
		case <-ctx.Done():
			return
		}
	}
}

func (s *server) handleGetRun(w http.ResponseWriter, r *http.Request) {
	runID := r.PathValue("runId")
	v, ok := s.runs.Load(runID)
	if !ok {
		writeJSON(w, http.StatusNotFound, errResp{Error: "run not found", Code: "not_found"})
		return
	}
	entry := v.(*runEntry)

	entry.mu.Lock()
	done := entry.done
	summary := entry.summary
	entry.mu.Unlock()

	if !done || summary == nil {
		writeJSON(w, http.StatusAccepted, map[string]string{"status": "running"})
		return
	}
	writeJSON(w, http.StatusOK, summary)
}
