package reporter

import (
	"fmt"
	"io"
	"strings"
	"time"

	enginehttp "github.com/guillaumedelre/reqlet/engine/http"
	"github.com/guillaumedelre/reqlet/engine/runner"
)

// ANSI colour codes — empty when noColor is true.
type palette struct {
	reset, bold, red, green, yellow, cyan, gray string
}

func newPalette(noColor bool) palette {
	if noColor {
		return palette{}
	}
	return palette{
		reset:  "\033[0m",
		bold:   "\033[1m",
		red:    "\033[31m",
		green:  "\033[32m",
		yellow: "\033[33m",
		cyan:   "\033[36m",
		gray:   "\033[90m",
	}
}

// CLI is a streaming terminal reporter.
type CLI struct {
	w       io.Writer
	c       palette
	verbose bool
	start   time.Time
}

// NewCLI creates a terminal reporter writing to w.
func NewCLI(w io.Writer, noColor, verbose bool) *CLI {
	return &CLI{w: w, c: newPalette(noColor), verbose: verbose}
}

// printf writes formatted output; terminal write errors are non-actionable.
func (r *CLI) printf(format string, args ...any) {
	fmt.Fprintf(r.w, format, args...) //nolint:errcheck
}

func (r *CLI) OnStart(name string) {
	r.start = time.Now()
	r.printf("\n%s%s%s\n\n", r.c.bold, name, r.c.reset)
}

func (r *CLI) OnRequest(iterIdx int, res runner.RequestResult) {
	c := r.c

	if res.Skipped {
		r.printf("  %s↪ %s (skipped)%s\n", c.gray, res.Name, c.reset)
		return
	}

	if res.Error != nil {
		r.printf("  %s✗ %s%s\n", c.red, res.Name, c.reset)
		r.printf("    %s%s%s\n", c.red, res.Error, c.reset)
		return
	}

	// Request line: name + response summary
	summary := responseSummary(res.Response)
	allPassed := true
	for _, t := range res.Tests {
		if !t.Passed {
			allPassed = false
			break
		}
	}

	if allPassed {
		r.printf("  %s✓ %s%s %s%s%s\n", c.green, res.Name, c.reset, c.gray, summary, c.reset)
	} else {
		r.printf("  %s✗ %s%s %s%s%s\n", c.red, res.Name, c.reset, c.gray, summary, c.reset)
	}

	for _, t := range res.Tests {
		if t.Passed {
			r.printf("    %s✓ %s%s\n", c.green, t.Name, c.reset)
		} else {
			r.printf("    %s✗ %s%s\n", c.red, t.Name, c.reset)
			if t.Error != "" {
				r.printf("      %s%s%s\n", c.yellow, t.Error, c.reset)
			}
		}
	}

	if r.verbose && res.Response != nil && len(res.Response.Body) > 0 {
		r.printf("    %s%s%s\n", c.gray, string(res.Response.Body), c.reset)
	}
}

func (r *CLI) OnDone(result *runner.RunResult) {
	c := r.c
	elapsed := time.Since(r.start)

	var totalReq, failedReq, totalTests, failedTests int
	for i := range result.Iterations {
		for j := range result.Iterations[i].Requests {
			req := result.Iterations[i].Requests[j]
			if req.Skipped {
				continue
			}
			totalReq++
			if !req.Passed() {
				failedReq++
			}
			for _, t := range req.Tests {
				totalTests++
				if !t.Passed {
					failedTests++
				}
			}
		}
	}

	sep := strings.Repeat("─", 48)
	r.printf("\n%s%s%s\n", c.gray, sep, c.reset)

	reqColor := c.green
	if failedReq > 0 {
		reqColor = c.red
	}
	testColor := c.green
	if failedTests > 0 {
		testColor = c.red
	}

	r.printf(" %sRequests%s   %d executed, %s%d failed%s\n",
		c.bold, c.reset, totalReq, reqColor, failedReq, c.reset)
	r.printf(" %sTests%s      %d executed, %s%d failed%s\n",
		c.bold, c.reset, totalTests, testColor, failedTests, c.reset)
	r.printf(" %sDuration%s   %s\n", c.bold, c.reset, elapsed.Round(time.Millisecond))
	r.printf("%s%s%s\n\n", c.gray, sep, c.reset)
}

func responseSummary(resp *enginehttp.Response) string {
	if resp == nil {
		return ""
	}
	size := len(resp.Body)
	unit := "B"
	fsize := float64(size)
	if size >= 1024 {
		fsize = float64(size) / 1024
		unit = "kB"
	}
	if fsize == float64(int(fsize)) {
		return fmt.Sprintf("[%s, %.0f %s, %dms]", resp.Status, fsize, unit, resp.Duration.Milliseconds())
	}
	return fmt.Sprintf("[%s, %.1f %s, %dms]", resp.Status, fsize, unit, resp.Duration.Milliseconds())
}
