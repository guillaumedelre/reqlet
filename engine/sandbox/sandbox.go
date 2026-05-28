// Package sandbox manages the Node.js script execution process.
package sandbox

import "context"

// ScriptContext holds all data the script can read and mutate.
type ScriptContext struct {
	Globals             map[string]string `json:"globals"`
	Environment         map[string]string `json:"environment"`
	CollectionVariables map[string]string `json:"collectionVariables"`
	IterationData       map[string]string `json:"iterationData"`
	Request             *RequestInfo      `json:"request,omitempty"`
	Response            *ResponseInfo     `json:"response,omitempty"`
	Info                ExecInfo          `json:"info"`
}

// RequestInfo is the subset of request data exposed to scripts.
type RequestInfo struct {
	URL     string            `json:"url"`
	Method  string            `json:"method"`
	Headers map[string]string `json:"headers"`
	Body    string            `json:"body"`
}

// ResponseInfo is the subset of response data exposed to test scripts.
type ResponseInfo struct {
	Status       string            `json:"status"`
	Code         int               `json:"code"`
	ResponseTime int64             `json:"responseTime"`
	ResponseSize int               `json:"responseSize"`
	Headers      map[string]string `json:"headers"`
	Body         string            `json:"body"`
}

// ExecInfo provides metadata about the current execution context.
type ExecInfo struct {
	EventName      string `json:"eventName"`
	Iteration      int    `json:"iteration"`
	IterationCount int    `json:"iterationCount"`
	RequestName    string `json:"requestName"`
	RequestID      string `json:"requestId"`
}

// TestResult holds the outcome of a single pm.test() call.
type TestResult struct {
	Name   string `json:"name"`
	Passed bool   `json:"passed"`
	Error  string `json:"error"`
}

// Mutations are the variable changes and flow directives produced by a script.
type Mutations struct {
	Globals             map[string]string `json:"globals"`
	Environment         map[string]string `json:"environment"`
	CollectionVariables map[string]string `json:"collectionVariables"`
	// NextRequest is nil when unchanged, non-nil when setNextRequest was called.
	// An empty string means "stop execution".
	NextRequest *string `json:"nextRequest"`
	SkipRequest bool    `json:"skipRequest"`
}

// ScriptResult is the full output of one script execution.
type ScriptResult struct {
	Tests          []TestResult `json:"tests"`
	Mutations      Mutations    `json:"mutations"`
	VisualizerHTML string       `json:"visualizerHtml,omitempty"`
}

// Runner executes JavaScript scripts in the Node.js sandbox.
type Runner interface {
	// Execute runs script in the given event context and returns the result.
	Execute(ctx context.Context, script, event string, sctx *ScriptContext) (*ScriptResult, error)
	// Close shuts down the underlying Node.js process.
	Close() error
}
