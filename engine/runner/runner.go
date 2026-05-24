package runner

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/guillaumedelre/reqlet/engine/auth"
	enginehttp "github.com/guillaumedelre/reqlet/engine/http"
	"github.com/guillaumedelre/reqlet/engine/parser"
	"github.com/guillaumedelre/reqlet/engine/sandbox"
	"github.com/guillaumedelre/reqlet/engine/variables"
)

// maxRequestsPerIteration prevents unbounded loops caused by setNextRequest cycles.
const maxRequestsPerIteration = 1000

// Options configures a collection run.
type Options struct {
	Iterations   int                 // number of times to run the collection; defaults to 1
	DelayMS      int                 // milliseconds to wait between requests
	Folder       string              // if non-empty, only run requests in this folder
	Bail         bool                // stop on the first failed test
	Data         []map[string]string // per-iteration variable data (CSV/JSON rows)
	SaveResponse bool                // attach the HTTP response to each RequestResult
}

// Runner orchestrates the sequential execution of a Postman collection.
type Runner struct {
	http    *enginehttp.Client
	sandbox sandbox.Runner
}

// New creates a Runner backed by the given HTTP client and script sandbox.
func New(h *enginehttp.Client, sb sandbox.Runner) *Runner {
	return &Runner{http: h, sandbox: sb}
}

// flatRequest pairs a request item with its ancestor folders (outermost first).
type flatRequest struct {
	name    string
	item    parser.Item
	folders []parser.Item
}

// flatten converts the nested item tree into an ordered list of leaf requests.
func flatten(items []parser.Item, ancestors []parser.Item) []flatRequest {
	var out []flatRequest
	for _, item := range items {
		if item.IsFolder() {
			out = append(out, flatten(item.Item, append(ancestors, item))...)
		} else {
			cp := make([]parser.Item, len(ancestors))
			copy(cp, ancestors)
			out = append(out, flatRequest{name: item.Name, item: item, folders: cp})
		}
	}
	return out
}

// filterFolder keeps only requests whose immediate parent folder matches name.
func filterFolder(flat []flatRequest, name string) []flatRequest {
	var out []flatRequest
	for _, fr := range flat {
		if len(fr.folders) > 0 && fr.folders[len(fr.folders)-1].Name == name {
			out = append(out, fr)
		}
	}
	return out
}

// findRequest returns the index of the first flat request named name, or -1.
func findRequest(flat []flatRequest, name string) int {
	for i, fr := range flat {
		if fr.name == name {
			return i
		}
	}
	return -1
}

// Run executes the collection for the configured number of iterations.
func (r *Runner) Run(ctx context.Context, col *parser.Collection, env *parser.Environment, opts Options) (*RunResult, error) {
	if opts.Iterations < 1 {
		opts.Iterations = 1
	}

	flat := flatten(col.Item, nil)
	if opts.Folder != "" {
		flat = filterFolder(flat, opts.Folder)
	}

	result := &RunResult{Name: col.Info.Name}

	for i := range opts.Iterations {
		vars := buildVars(col, env)
		if i < len(opts.Data) {
			for k, v := range opts.Data[i] {
				vars.Set(variables.ScopeData, k, v)
			}
		}

		iterResult, err := r.runIteration(ctx, col, flat, vars, i, opts)
		if err != nil {
			return nil, err
		}
		result.Iterations = append(result.Iterations, iterResult)

		if opts.Bail && !iterResult.Passed() {
			break
		}
	}

	return result, nil
}

func (r *Runner) runIteration(ctx context.Context, col *parser.Collection, flat []flatRequest, vars *variables.Resolver, iterIdx int, opts Options) (IterationResult, error) {
	result := IterationResult{Index: iterIdx}
	execCount := 0
	i := 0

	for i < len(flat) {
		if execCount >= maxRequestsPerIteration {
			return result, fmt.Errorf("runner: exceeded %d requests per iteration (setNextRequest loop?)", maxRequestsPerIteration)
		}

		if opts.DelayMS > 0 && execCount > 0 {
			select {
			case <-ctx.Done():
				return result, ctx.Err()
			case <-time.After(time.Duration(opts.DelayMS) * time.Millisecond):
			}
		}
		execCount++

		reqResult, err := r.runRequest(ctx, col, flat[i], vars, iterIdx, opts.Iterations, opts.SaveResponse)
		if err != nil {
			return result, err
		}
		result.Requests = append(result.Requests, reqResult)

		if opts.Bail && !reqResult.Passed() {
			return result, nil
		}

		// Flow control via pm.execution.setNextRequest
		switch {
		case reqResult.NextRequest == nil:
			i++
		case *reqResult.NextRequest == "":
			return result, nil // stop iteration
		default:
			j := findRequest(flat, *reqResult.NextRequest)
			if j < 0 {
				i++
			} else {
				i = j
			}
		}
	}

	return result, nil
}

func (r *Runner) runRequest(ctx context.Context, col *parser.Collection, fr flatRequest, vars *variables.Resolver, iterIdx, iterCount int, saveResponse bool) (RequestResult, error) {
	info := sandbox.ExecInfo{
		EventName:      "prerequest",
		Iteration:      iterIdx,
		IterationCount: iterCount,
		RequestName:    fr.name,
		RequestID:      fr.name,
	}

	// Pre-request scripts: collection → folders → request (outside-in)
	for _, script := range joinScripts(col.Event, fr.folders, fr.item.Event, "prerequest") {
		sctx := buildScriptContext(vars, fr.item.Request, nil, info)
		res, err := r.sandbox.Execute(ctx, script, "prerequest", sctx)
		if err != nil {
			return RequestResult{Name: fr.name, Error: fmt.Errorf("prerequest script: %w", err)}, nil
		}
		applyMutations(vars, res.Mutations)
		if res.Mutations.SkipRequest {
			return RequestResult{Name: fr.name, Skipped: true}, nil
		}
	}

	// Resolve auth for this request (inheritance: request > folder > collection)
	applier, err := resolveAuth(fr.item.Request, fr.folders, col)
	if err != nil {
		return RequestResult{Name: fr.name, Error: fmt.Errorf("auth: %w", err)}, nil
	}

	// Execute HTTP request
	httpResp, httpErr := r.http.Execute(ctx, fr.item.Request, vars, applier)
	if httpErr != nil && ctx.Err() != nil {
		return RequestResult{}, ctx.Err()
	}

	// Test scripts: collection → folders → request (outside-in)
	info.EventName = "test"
	var allTests []sandbox.TestResult
	var nextReq *string

	if httpErr == nil {
		for _, script := range joinScripts(col.Event, fr.folders, fr.item.Event, "test") {
			sctx := buildScriptContext(vars, fr.item.Request, httpResp, info)
			res, err := r.sandbox.Execute(ctx, script, "test", sctx)
			if err != nil {
				return RequestResult{Name: fr.name, Error: fmt.Errorf("test script: %w", err)}, nil
			}
			allTests = append(allTests, res.Tests...)
			applyMutations(vars, res.Mutations)
			if res.Mutations.NextRequest != nil {
				nextReq = res.Mutations.NextRequest
			}
		}
	}

	result := RequestResult{
		Name:        fr.name,
		Error:       httpErr,
		Tests:       allTests,
		NextRequest: nextReq,
	}
	if saveResponse && httpResp != nil {
		result.Response = httpResp
	}
	return result, nil
}

// joinScripts collects scripts of a given type from collection, folders, and request events.
// Order: collection → outermost folder → ... → innermost folder → request.
func joinScripts(colEvents []parser.Event, folders []parser.Item, reqEvents []parser.Event, eventType string) []string {
	var scripts []string
	for _, ev := range colEvents {
		if ev.Listen == eventType {
			scripts = append(scripts, strings.Join(ev.Script.Exec, "\n"))
		}
	}
	for _, folder := range folders {
		for _, ev := range folder.Event {
			if ev.Listen == eventType {
				scripts = append(scripts, strings.Join(ev.Script.Exec, "\n"))
			}
		}
	}
	for _, ev := range reqEvents {
		if ev.Listen == eventType {
			scripts = append(scripts, strings.Join(ev.Script.Exec, "\n"))
		}
	}
	return scripts
}

// buildVars initialises the variable resolver from collection variables and environment.
func buildVars(col *parser.Collection, env *parser.Environment) *variables.Resolver {
	vars := variables.NewResolver()
	for _, v := range col.Variable {
		if !v.Disabled {
			vars.Set(variables.ScopeCollection, v.Key, v.Value)
		}
	}
	if env != nil {
		for _, v := range env.Values {
			if v.Enabled {
				vars.Set(variables.ScopeEnvironment, v.Key, v.Value)
			}
		}
	}
	return vars
}

// buildScriptContext constructs the sandbox input for a single script execution.
func buildScriptContext(vars *variables.Resolver, req *parser.Request, resp *enginehttp.Response, info sandbox.ExecInfo) *sandbox.ScriptContext {
	sctx := &sandbox.ScriptContext{
		Globals:             vars.Snapshot(variables.ScopeGlobal),
		Environment:         vars.Snapshot(variables.ScopeEnvironment),
		CollectionVariables: vars.Snapshot(variables.ScopeCollection),
		IterationData:       vars.Snapshot(variables.ScopeData),
		Info:                info,
	}

	if req != nil {
		headers := make(map[string]string, len(req.Header))
		for _, h := range req.Header {
			if !h.Disabled {
				headers[vars.Resolve(h.Key)] = vars.Resolve(h.Value)
			}
		}
		body := ""
		if req.Body != nil && req.Body.Mode == parser.BodyModeRaw {
			body = vars.Resolve(req.Body.Raw)
		}
		sctx.Request = &sandbox.RequestInfo{
			URL:     vars.Resolve(req.URL.Raw),
			Method:  req.Method,
			Headers: headers,
			Body:    body,
		}
	}

	if resp != nil {
		respHeaders := make(map[string]string, len(resp.Headers))
		for k, v := range resp.Headers {
			if len(v) > 0 {
				respHeaders[k] = v[0]
			}
		}
		sctx.Response = &sandbox.ResponseInfo{
			Status:       resp.Status,
			Code:         resp.StatusCode,
			ResponseTime: resp.Duration.Milliseconds(),
			ResponseSize: len(resp.Body),
			Headers:      respHeaders,
			Body:         string(resp.Body),
		}
	}

	return sctx
}

// applyMutations writes sandbox variable mutations back into the resolver.
func applyMutations(vars *variables.Resolver, m sandbox.Mutations) {
	vars.ReplaceScope(variables.ScopeGlobal, m.Globals)
	vars.ReplaceScope(variables.ScopeEnvironment, m.Environment)
	vars.ReplaceScope(variables.ScopeCollection, m.CollectionVariables)
}

// resolveAuth determines the effective auth for a request via the inheritance chain.
// folderAuths must be ordered outermost-first (matching fr.folders).
func resolveAuth(req *parser.Request, folders []parser.Item, col *parser.Collection) (auth.Applier, error) {
	folderAuths := make([]*parser.Auth, len(folders))
	for i, f := range folders {
		folderAuths[len(folders)-1-i] = f.Auth // innermost first for auth.Resolve
	}
	effective := auth.Resolve(req.Auth, folderAuths, col.Auth)
	if effective == nil {
		return nil, nil
	}
	return auth.New(effective)
}
