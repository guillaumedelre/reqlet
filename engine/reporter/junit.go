package reporter

import (
	"encoding/xml"
	"fmt"
	"io"
	"os"
	"time"

	"github.com/guillaumedelre/reqlet/engine/runner"
)

// JUnit writes a JUnit-compatible XML report on completion.
type JUnit struct {
	path  string
	w     io.Writer // non-nil overrides path (used in tests)
	start time.Time
}

// NewJUnit creates a JUnit reporter that writes to path ("-" for stdout).
func NewJUnit(path string) *JUnit { return &JUnit{path: path} }

// NewJUnitWriter creates a JUnit reporter that writes to w.
func NewJUnitWriter(w io.Writer) *JUnit { return &JUnit{w: w} }

func (r *JUnit) OnStart(_ string)                        { r.start = time.Now() }
func (r *JUnit) OnRequest(_ int, _ runner.RequestResult) {}

type xmlTestSuites struct {
	XMLName    xml.Name       `xml:"testsuites"`
	Name       string         `xml:"name,attr"`
	Tests      int            `xml:"tests,attr"`
	Failures   int            `xml:"failures,attr"`
	Errors     int            `xml:"errors,attr"`
	Time       string         `xml:"time,attr"`
	TestSuites []xmlTestSuite `xml:"testsuite"`
}

type xmlTestSuite struct {
	Name      string        `xml:"name,attr"`
	Tests     int           `xml:"tests,attr"`
	Failures  int           `xml:"failures,attr"`
	Errors    int           `xml:"errors,attr"`
	Time      string        `xml:"time,attr"`
	TestCases []xmlTestCase `xml:"testcase"`
}

type xmlTestCase struct {
	Name      string      `xml:"name,attr"`
	Classname string      `xml:"classname,attr"`
	Time      string      `xml:"time,attr"`
	Failure   *xmlFailure `xml:"failure,omitempty"`
}

type xmlFailure struct {
	Message string `xml:"message,attr"`
	Type    string `xml:"type,attr"`
	Text    string `xml:",chardata"`
}

func (r *JUnit) OnDone(result *runner.RunResult) {
	elapsed := time.Since(r.start)
	suites := buildJUnitSuites(result, elapsed)

	w := r.w
	if w == nil {
		if r.path == "-" {
			w = os.Stdout
		} else {
			f, err := os.Create(r.path) //nolint:gosec // path provided by user
			if err != nil {
				fmt.Fprintf(os.Stderr, "reporter: cannot write JUnit report: %v\n", err)
				return
			}
			defer func() { _ = f.Close() }()
			w = f
		}
	}

	if _, err := fmt.Fprintf(w, "%s\n", xml.Header); err != nil {
		fmt.Fprintf(os.Stderr, "reporter: write XML header: %v\n", err)
		return
	}
	enc := xml.NewEncoder(w)
	enc.Indent("", "  ")
	if err := enc.Encode(suites); err != nil {
		fmt.Fprintf(os.Stderr, "reporter: XML encode error: %v\n", err)
	}
	_, _ = fmt.Fprintln(w)
}

func buildJUnitSuites(result *runner.RunResult, elapsed time.Duration) xmlTestSuites {
	suites := xmlTestSuites{
		Name: result.Name,
		Time: fmtSeconds(elapsed),
	}

	for i := range result.Iterations {
		iter := result.Iterations[i]
		suite := xmlTestSuite{
			Name: fmt.Sprintf("Iteration %d", iter.Index+1),
			Time: fmtSeconds(elapsed),
		}

		for j := range iter.Requests {
			req := iter.Requests[j]
			if req.Skipped {
				continue
			}

			respTime := ""
			if req.Response != nil {
				respTime = fmtSeconds(req.Response.Duration)
			}

			if req.Error != nil {
				tc := xmlTestCase{
					Name:      req.Name,
					Classname: req.Name,
					Time:      respTime,
					Failure: &xmlFailure{
						Message: req.Error.Error(),
						Type:    "HTTPError",
						Text:    req.Error.Error(),
					},
				}
				suite.TestCases = append(suite.TestCases, tc)
				suite.Tests++
				suite.Failures++
				continue
			}

			for _, t := range req.Tests {
				tc := xmlTestCase{
					Name:      fmt.Sprintf("%s - %s", req.Name, t.Name),
					Classname: req.Name,
					Time:      respTime,
				}
				if !t.Passed {
					tc.Failure = &xmlFailure{
						Message: t.Name,
						Type:    "AssertionFailure",
						Text:    t.Error,
					}
					suite.Failures++
				}
				suite.Tests++
				suite.TestCases = append(suite.TestCases, tc)
			}
		}

		suites.Tests += suite.Tests
		suites.Failures += suite.Failures
		suites.TestSuites = append(suites.TestSuites, suite)
	}

	return suites
}

func fmtSeconds(d time.Duration) string {
	return fmt.Sprintf("%.3f", d.Seconds())
}
