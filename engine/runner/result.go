// Package runner orchestrates the sequential execution of a Postman collection.
package runner

import (
	enginehttp "github.com/guillaumedelre/reqlet/engine/http"
	"github.com/guillaumedelre/reqlet/engine/sandbox"
)

// RunResult is the result of a complete collection run (all iterations).
type RunResult struct {
	Name       string
	Iterations []IterationResult
}

// Passed reports whether every test in every iteration passed.
func (r *RunResult) Passed() bool {
	for i := range r.Iterations {
		if !r.Iterations[i].Passed() {
			return false
		}
	}
	return true
}

// IterationResult holds the results for one iteration of a run.
type IterationResult struct {
	Index    int
	Requests []RequestResult
}

// Passed reports whether every request result in the iteration passed.
func (it *IterationResult) Passed() bool {
	for i := range it.Requests {
		if !it.Requests[i].Passed() {
			return false
		}
	}
	return true
}

// RequestResult is the result of executing a single request item.
type RequestResult struct {
	Name        string
	Skipped     bool
	Error       error
	Tests       []sandbox.TestResult
	Response    *enginehttp.Response // non-nil only when Options.SaveResponse is true
	NextRequest *string              // nil=next in sequence, ""=stop, "Name"=jump
}

// Passed reports whether all tests passed and no HTTP error occurred.
// A skipped request is not a failure.
func (r *RequestResult) Passed() bool {
	if r.Skipped {
		return true
	}
	if r.Error != nil {
		return false
	}
	for _, t := range r.Tests {
		if !t.Passed {
			return false
		}
	}
	return true
}
