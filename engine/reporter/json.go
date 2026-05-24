package reporter

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"time"

	"github.com/guillaumedelre/reqlet/engine/runner"
	"github.com/guillaumedelre/reqlet/engine/sandbox"
)

// JSON buffers the full run result and writes a structured JSON report on completion.
type JSON struct {
	path  string
	w     io.Writer // non-nil overrides path (used in tests)
	start time.Time
}

// NewJSON creates a JSON reporter that writes to path ("-" for stdout).
func NewJSON(path string) *JSON { return &JSON{path: path} }

// NewJSONWriter creates a JSON reporter that writes to w.
func NewJSONWriter(w io.Writer) *JSON { return &JSON{w: w} }

func (r *JSON) OnStart(_ string)                        { r.start = time.Now() }
func (r *JSON) OnRequest(_ int, _ runner.RequestResult) {}

type jsonReport struct {
	Collection string          `json:"collection"`
	Stats      jsonStats       `json:"stats"`
	DurationMS int64           `json:"duration_ms"`
	Iterations []jsonIteration `json:"iterations"`
}

type jsonStats struct {
	Requests jsonCount `json:"requests"`
	Tests    jsonCount `json:"tests"`
}

type jsonCount struct {
	Total  int `json:"total"`
	Failed int `json:"failed"`
}

type jsonIteration struct {
	Index    int           `json:"index"`
	Requests []jsonRequest `json:"requests"`
}

type jsonRequest struct {
	Name    string     `json:"name"`
	Skipped bool       `json:"skipped,omitempty"`
	Error   string     `json:"error,omitempty"`
	Tests   []jsonTest `json:"tests,omitempty"`
}

type jsonTest struct {
	Name   string `json:"name"`
	Passed bool   `json:"passed"`
	Error  string `json:"error,omitempty"`
}

func (r *JSON) OnDone(result *runner.RunResult) {
	report := buildJSONReport(result, r.start)

	w := r.w
	if w == nil {
		if r.path == "-" {
			w = os.Stdout
		} else {
			f, err := os.Create(r.path) //nolint:gosec // path provided by user
			if err != nil {
				fmt.Fprintf(os.Stderr, "reporter: cannot write JSON report: %v\n", err)
				return
			}
			defer func() { _ = f.Close() }()
			w = f
		}
	}

	enc := json.NewEncoder(w)
	enc.SetIndent("", "  ")
	if err := enc.Encode(report); err != nil {
		fmt.Fprintf(os.Stderr, "reporter: JSON encode error: %v\n", err)
	}
}

func buildJSONReport(result *runner.RunResult, start time.Time) jsonReport {
	report := jsonReport{
		Collection: result.Name,
		DurationMS: time.Since(start).Milliseconds(),
	}

	for i := range result.Iterations {
		iter := result.Iterations[i]
		ji := jsonIteration{Index: iter.Index}
		for j := range iter.Requests {
			req := iter.Requests[j]
			jr := jsonRequest{Name: req.Name, Skipped: req.Skipped}
			if req.Error != nil {
				jr.Error = req.Error.Error()
				report.Stats.Requests.Failed++
			}
			if !req.Skipped {
				report.Stats.Requests.Total++
				if !req.Passed() && req.Error == nil {
					report.Stats.Requests.Failed++
				}
			}
			jr.Tests = mapTests(req.Tests, &report.Stats.Tests)
			ji.Requests = append(ji.Requests, jr)
		}
		report.Iterations = append(report.Iterations, ji)
	}

	return report
}

func mapTests(tests []sandbox.TestResult, stats *jsonCount) []jsonTest {
	if len(tests) == 0 {
		return nil
	}
	out := make([]jsonTest, len(tests))
	for i, t := range tests {
		stats.Total++
		if !t.Passed {
			stats.Failed++
		}
		out[i] = jsonTest{Name: t.Name, Passed: t.Passed, Error: t.Error}
	}
	return out
}
