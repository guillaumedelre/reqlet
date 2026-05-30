package reporter

import (
	"bytes"
	"encoding/json"
	"encoding/xml"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	enginehttp "github.com/guillaumedelre/reqlet/engine/http"
	"github.com/guillaumedelre/reqlet/engine/runner"
	"github.com/guillaumedelre/reqlet/engine/sandbox"
)

// ── helpers ──────────────────────────────────────────────────────────────────

func makeResponse(statusCode int, status string, body []byte, dur time.Duration) *enginehttp.Response {
	return &enginehttp.Response{
		StatusCode: statusCode,
		Status:     status,
		Body:       body,
		Duration:   dur,
	}
}

func makeResult(name string, tests []sandbox.TestResult, resp *enginehttp.Response) runner.RequestResult {
	return runner.RequestResult{Name: name, Tests: tests, Response: resp}
}

func makeRun(colName string, iters ...runner.IterationResult) *runner.RunResult {
	return &runner.RunResult{Name: colName, Iterations: iters}
}

func makeIter(idx int, reqs ...runner.RequestResult) runner.IterationResult {
	return runner.IterationResult{Index: idx, Requests: reqs}
}

// runJUnit runs OnStart + OnDone and returns the written XML as a string.
func runJUnit(t *testing.T, result *runner.RunResult) string {
	t.Helper()
	var buf bytes.Buffer
	r := NewJUnitWriter(&buf)
	r.OnStart(result.Name)
	r.OnDone(result)
	return buf.String()
}

// runJSON runs OnStart + OnDone and returns the written JSON as a string.
func runJSON(t *testing.T, result *runner.RunResult) string {
	t.Helper()
	var buf bytes.Buffer
	r := NewJSONWriter(&buf)
	r.OnStart(result.Name)
	r.OnDone(result)
	return buf.String()
}

// ── JUnit output format ───────────────────────────────────────────────────────

func TestJUnit_Output_ValidXML(t *testing.T) {
	result := makeRun(
		"MyCollection",
		makeIter(
			0,
			makeResult("Get Users", []sandbox.TestResult{
				{Name: "Status 200", Passed: true},
			}, makeResponse(200, "200 OK", nil, 100*time.Millisecond)),
		),
	)

	out := runJUnit(t, result)

	// Must start with the XML declaration
	assert.True(t, strings.HasPrefix(out, "<?xml version="), "missing XML declaration")

	// Must be parseable as valid XML into the testsuites schema
	var suites xmlTestSuites
	body := []byte(out)[len(xml.Header):]
	require.NoError(t, xml.Unmarshal(body, &suites), "output is not valid XML")
}

func TestJUnit_Output_RootElement(t *testing.T) {
	result := makeRun(
		"API Suite",
		makeIter(
			0,
			makeResult("GET /ping", []sandbox.TestResult{
				{Name: "Status 200", Passed: true},
				{Name: "Latency OK", Passed: true},
			}, makeResponse(200, "200 OK", nil, 12*time.Millisecond)),
		),
	)

	out := runJUnit(t, result)
	assert.Contains(t, out, `name="API Suite"`)
	assert.Contains(t, out, `tests="2"`)
	assert.Contains(t, out, `failures="0"`)
}

func TestJUnit_Output_Testsuite(t *testing.T) {
	result := makeRun(
		"Suite",
		makeIter(
			0,
			makeResult("R1", []sandbox.TestResult{{Name: "T1", Passed: true}},
				makeResponse(200, "200 OK", nil, 10*time.Millisecond)),
		),
	)

	out := runJUnit(t, result)
	assert.Contains(t, out, `<testsuite`)
	assert.Contains(t, out, `name="Iteration 1"`)
}

func TestJUnit_Output_Testcase(t *testing.T) {
	result := makeRun(
		"Col",
		makeIter(
			0,
			makeResult("Create User", []sandbox.TestResult{
				{Name: "Returns 201", Passed: true},
			}, makeResponse(201, "201 Created", nil, 55*time.Millisecond)),
		),
	)

	out := runJUnit(t, result)
	assert.Contains(t, out, `<testcase`)
	assert.Contains(t, out, `name="Create User - Returns 201"`)
	assert.Contains(t, out, `classname="Create User"`)
	// No failure element for a passing test
	assert.NotContains(t, out, `<failure`)
}

func TestJUnit_Output_Failure(t *testing.T) {
	result := makeRun(
		"Col",
		makeIter(
			0,
			makeResult("POST /users", []sandbox.TestResult{
				{Name: "Status 201", Passed: false, Error: "expected 201 but got 422"},
			}, makeResponse(422, "422 Unprocessable Entity", nil, 30*time.Millisecond)),
		),
	)

	out := runJUnit(t, result)
	assert.Contains(t, out, `failures="1"`)
	assert.Contains(t, out, `<failure`)
	assert.Contains(t, out, `type="AssertionFailure"`)
	assert.Contains(t, out, `message="Status 201"`)
	assert.Contains(t, out, "expected 201 but got 422")
}

func TestJUnit_Output_HTTPError(t *testing.T) {
	result := makeRun(
		"Col",
		makeIter(
			0,
			runner.RequestResult{Name: "GET /down", Error: errors.New("connection refused")},
		),
	)

	out := runJUnit(t, result)
	assert.Contains(t, out, `type="HTTPError"`)
	assert.Contains(t, out, "connection refused")
}

func TestJUnit_Output_SkippedExcluded(t *testing.T) {
	result := makeRun(
		"Col",
		makeIter(
			0,
			runner.RequestResult{Name: "Skipped", Skipped: true},
			makeResult("Normal", []sandbox.TestResult{{Name: "OK", Passed: true}},
				makeResponse(200, "200 OK", nil, 5*time.Millisecond)),
		),
	)

	out := runJUnit(t, result)
	assert.NotContains(t, out, "Skipped")
	assert.Contains(t, out, `tests="1"`)
}

func TestJUnit_Output_MultipleIterations(t *testing.T) {
	tests := []sandbox.TestResult{{Name: "OK", Passed: true}}
	resp := makeResponse(200, "200 OK", nil, 10*time.Millisecond)

	result := makeRun(
		"Multi",
		makeIter(0, makeResult("Req", tests, resp)),
		makeIter(1, makeResult("Req", tests, resp)),
	)

	out := runJUnit(t, result)
	assert.Contains(t, out, `name="Iteration 1"`)
	assert.Contains(t, out, `name="Iteration 2"`)
	// "<testsuite " (with trailing space) matches only <testsuite> children, not <testsuites>
	assert.Equal(t, 2, strings.Count(out, "<testsuite "))
}

func TestJUnit_Output_TimeAttribute(t *testing.T) {
	result := makeRun(
		"Col",
		makeIter(
			0,
			makeResult("R", []sandbox.TestResult{{Name: "T", Passed: true}},
				makeResponse(200, "200 OK", nil, 500*time.Millisecond)),
		),
	)

	out := runJUnit(t, result)
	// time attribute should be present and formatted as seconds with 3 decimal places
	assert.Contains(t, out, `time="`)
	// The testcase time reflects the response duration (0.500)
	assert.Contains(t, out, `time="0.500"`)
}

// ── JUnit internal helpers ────────────────────────────────────────────────────

func TestJUnit_AllPassed(t *testing.T) {
	result := makeRun(
		"MyCollection",
		makeIter(
			0,
			makeResult("Get Users", []sandbox.TestResult{
				{Name: "Status 200", Passed: true},
				{Name: "Body not empty", Passed: true},
			}, makeResponse(200, "200 OK", []byte(`[]`), 120*time.Millisecond)),
		),
	)

	suites := buildJUnitSuites(result, 200*time.Millisecond)

	assert.Equal(t, "MyCollection", suites.Name)
	assert.Equal(t, 2, suites.Tests)
	assert.Equal(t, 0, suites.Failures)
	require.Len(t, suites.TestSuites, 1)

	suite := suites.TestSuites[0]
	assert.Equal(t, "Iteration 1", suite.Name)
	assert.Equal(t, 2, suite.Tests)
	assert.Equal(t, 0, suite.Failures)
	require.Len(t, suite.TestCases, 2)

	tc := suite.TestCases[0]
	assert.Equal(t, "Get Users - Status 200", tc.Name)
	assert.Equal(t, "Get Users", tc.Classname)
	assert.Nil(t, tc.Failure)
}

func TestJUnit_TimeFormat(t *testing.T) {
	assert.Equal(t, "1.500", fmtSeconds(1500*time.Millisecond))
	assert.Equal(t, "0.123", fmtSeconds(123*time.Millisecond))
}

func TestJUnit_NoRequests(t *testing.T) {
	result := makeRun("Empty", makeIter(0))
	suites := buildJUnitSuites(result, 0)
	assert.Equal(t, 0, suites.Tests)
	assert.Equal(t, 0, suites.Failures)
	assert.Empty(t, suites.TestSuites[0].TestCases)
}

// ── JSON output format ────────────────────────────────────────────────────────

func TestJSON_Output_ValidJSON(t *testing.T) {
	result := makeRun(
		"API",
		makeIter(
			0,
			makeResult("GET /users", []sandbox.TestResult{
				{Name: "Status 200", Passed: true},
			}, makeResponse(200, "200 OK", []byte("[]"), 80*time.Millisecond)),
		),
	)

	out := runJSON(t, result)

	var decoded map[string]interface{}
	require.NoError(t, json.Unmarshal([]byte(out), &decoded), "output is not valid JSON")
}

func TestJSON_Output_CollectionField(t *testing.T) {
	result := makeRun(
		"My API Tests",
		makeIter(
			0,
			makeResult("R", []sandbox.TestResult{{Name: "OK", Passed: true}},
				makeResponse(200, "200 OK", nil, 5*time.Millisecond)),
		),
	)

	out := runJSON(t, result)
	assert.Contains(t, out, `"collection"`)
	assert.Contains(t, out, `"My API Tests"`)
}

func TestJSON_Output_Stats(t *testing.T) {
	result := makeRun(
		"API",
		makeIter(
			0,
			makeResult("R1", []sandbox.TestResult{
				{Name: "Status 200", Passed: true},
				{Name: "Body OK", Passed: false, Error: "body was empty"},
			}, makeResponse(200, "200 OK", nil, 10*time.Millisecond)),
		),
	)

	out := runJSON(t, result)

	// Validate stats structure via JSON unmarshal
	var report jsonReport
	require.NoError(t, json.Unmarshal([]byte(out), &report))

	assert.Equal(t, 1, report.Stats.Requests.Total)
	assert.Equal(t, 1, report.Stats.Requests.Failed, "request with a failed test counts as failed")
	assert.Equal(t, 2, report.Stats.Tests.Total)
	assert.Equal(t, 1, report.Stats.Tests.Failed)
}

func TestJSON_Output_IterationsAndRequests(t *testing.T) {
	result := makeRun(
		"API",
		makeIter(
			0,
			makeResult("GET /users", []sandbox.TestResult{{Name: "OK", Passed: true}},
				makeResponse(200, "200 OK", nil, 10*time.Millisecond)),
		),
		makeIter(
			1,
			makeResult("GET /users", []sandbox.TestResult{{Name: "OK", Passed: true}},
				makeResponse(200, "200 OK", nil, 8*time.Millisecond)),
		),
	)

	out := runJSON(t, result)

	var report jsonReport
	require.NoError(t, json.Unmarshal([]byte(out), &report))

	require.Len(t, report.Iterations, 2)
	assert.Equal(t, 0, report.Iterations[0].Index)
	assert.Equal(t, 1, report.Iterations[1].Index)

	req := report.Iterations[0].Requests[0]
	assert.Equal(t, "GET /users", req.Name)
	require.Len(t, req.Tests, 1)
	assert.Equal(t, "OK", req.Tests[0].Name)
	assert.True(t, req.Tests[0].Passed)
}

func TestJSON_Output_HTTPError(t *testing.T) {
	result := makeRun(
		"API",
		makeIter(
			0,
			runner.RequestResult{Name: "Broken", Error: errors.New("connection refused")},
		),
	)

	out := runJSON(t, result)

	var report jsonReport
	require.NoError(t, json.Unmarshal([]byte(out), &report))

	req := report.Iterations[0].Requests[0]
	assert.Equal(t, "connection refused", req.Error)
}

func TestJSON_Output_FailedTestError(t *testing.T) {
	result := makeRun(
		"API",
		makeIter(
			0,
			makeResult("POST /users", []sandbox.TestResult{
				{Name: "Status 201", Passed: false, Error: "expected 201 but got 422"},
			}, makeResponse(422, "422 Unprocessable Entity", nil, 20*time.Millisecond)),
		),
	)

	out := runJSON(t, result)

	var report jsonReport
	require.NoError(t, json.Unmarshal([]byte(out), &report))

	test := report.Iterations[0].Requests[0].Tests[0]
	assert.False(t, test.Passed)
	assert.Equal(t, "expected 201 but got 422", test.Error)
}

func TestJSON_Output_DurationMS(t *testing.T) {
	result := makeRun("API", makeIter(0))
	out := runJSON(t, result)
	assert.Contains(t, out, `"duration_ms"`)
}

// ── CLI reporter — pass/fail colours ─────────────────────────────────────────

const (
	ansiReset  = "\033[0m"
	ansiRed    = "\033[31m"
	ansiGreen  = "\033[32m"
	ansiYellow = "\033[33m"
	ansiBold   = "\033[1m"
	ansiGray   = "\033[90m"
)

func TestCLI_Color_PassedRequest(t *testing.T) {
	var buf bytes.Buffer
	r := NewCLI(&buf, false, false) // noColor=false → ANSI enabled
	r.OnRequest(0, makeResult("Get Users", []sandbox.TestResult{
		{Name: "Status 200", Passed: true},
	}, makeResponse(200, "200 OK", nil, 100*time.Millisecond)))

	out := buf.String()
	// Request line and passing test both use green
	assert.Contains(t, out, ansiGreen, "passed request line must use green")
	assert.Contains(t, out, "✓")
	assert.NotContains(t, out, ansiRed, "no red when all tests pass")
}

func TestCLI_Color_FailedRequest(t *testing.T) {
	var buf bytes.Buffer
	r := NewCLI(&buf, false, false)
	r.OnRequest(0, makeResult("POST /users", []sandbox.TestResult{
		{Name: "Status 201", Passed: false, Error: "got 422"},
	}, makeResponse(422, "422 Unprocessable Entity", nil, 30*time.Millisecond)))

	out := buf.String()
	assert.Contains(t, out, ansiRed, "failed request line must use red")
	assert.Contains(t, out, "✗")
	// Error text shown in yellow
	assert.Contains(t, out, ansiYellow)
	assert.Contains(t, out, "got 422")
}

func TestCLI_Color_MixedTests(t *testing.T) {
	var buf bytes.Buffer
	r := NewCLI(&buf, false, false)
	r.OnRequest(0, makeResult("GET /items", []sandbox.TestResult{
		{Name: "Status 200", Passed: true},
		{Name: "Schema valid", Passed: false, Error: "missing field"},
	}, makeResponse(200, "200 OK", nil, 20*time.Millisecond)))

	out := buf.String()
	// Request line is red (at least one failure)
	assert.Contains(t, out, ansiRed)
	// Passed test still shown in green
	assert.Contains(t, out, ansiGreen)
}

func TestCLI_Color_NoColor_NoANSI(t *testing.T) {
	var buf bytes.Buffer
	r := NewCLI(&buf, true, false) // noColor=true
	r.OnRequest(0, makeResult("GET /ping", []sandbox.TestResult{
		{Name: "OK", Passed: true},
	}, makeResponse(200, "200 OK", nil, 5*time.Millisecond)))
	r.OnRequest(0, makeResult("POST /fail", []sandbox.TestResult{
		{Name: "Status 201", Passed: false, Error: "nope"},
	}, makeResponse(500, "500 Internal Server Error", nil, 10*time.Millisecond)))

	assert.NotContains(t, buf.String(), "\033[", "noColor must suppress all ANSI codes")
}

func TestCLI_Color_HTTPError_Red(t *testing.T) {
	var buf bytes.Buffer
	r := NewCLI(&buf, false, false)
	r.OnRequest(0, runner.RequestResult{
		Name:  "Broken",
		Error: errors.New("connection refused"),
	})

	assert.Contains(t, buf.String(), ansiRed)
}

func TestCLI_Color_Skipped_Gray(t *testing.T) {
	var buf bytes.Buffer
	r := NewCLI(&buf, false, false)
	r.OnRequest(0, runner.RequestResult{Name: "Skipped", Skipped: true})

	out := buf.String()
	assert.Contains(t, out, ansiGray, "skipped request must use gray")
	assert.Contains(t, out, "skipped")
}

func TestCLI_Color_Summary_Bold(t *testing.T) {
	var buf bytes.Buffer
	r := NewCLI(&buf, false, false)
	r.OnStart("My Collection")
	r.OnDone(makeRun("My Collection", makeIter(
		0,
		makeResult("R", []sandbox.TestResult{{Name: "T", Passed: true}},
			makeResponse(200, "200 OK", nil, 10*time.Millisecond)),
	)))

	out := buf.String()
	assert.Contains(t, out, ansiBold, "summary labels must be bold")
	assert.Contains(t, out, ansiGreen, "zero failures → green counters")
}

func TestCLI_Color_Summary_RedOnFailure(t *testing.T) {
	var buf bytes.Buffer
	r := NewCLI(&buf, false, false)
	r.OnStart("Col")
	r.OnDone(makeRun("Col", makeIter(
		0,
		makeResult("R", []sandbox.TestResult{
			{Name: "T", Passed: false, Error: "fail"},
		}, makeResponse(500, "500 Internal Server Error", nil, 5*time.Millisecond)),
	)))

	assert.Contains(t, buf.String(), ansiRed, "failure count in summary must be red")
}

// ── CLI reporter — basic output ───────────────────────────────────────────────

func TestCLI_OnStart(t *testing.T) {
	var buf bytes.Buffer
	r := NewCLI(&buf, true, false)
	r.OnStart("My Collection")
	assert.Contains(t, buf.String(), "My Collection")
}

func TestCLI_OnDone_Summary(t *testing.T) {
	var buf bytes.Buffer
	r := NewCLI(&buf, true, false)
	r.OnStart("Col")
	r.OnDone(makeRun(
		"Col",
		makeIter(
			0,
			makeResult("R1", []sandbox.TestResult{{Name: "T1", Passed: true}},
				makeResponse(200, "200 OK", nil, 10*time.Millisecond)),
			makeResult("R2", []sandbox.TestResult{{Name: "T2", Passed: false, Error: "fail"}},
				makeResponse(500, "500 Internal Server Error", nil, 20*time.Millisecond)),
		),
	))
	out := buf.String()
	assert.Contains(t, out, "2 executed")
	assert.Contains(t, out, "1 failed")
}

func TestCLI_Verbose_ShowsBody(t *testing.T) {
	var buf bytes.Buffer
	r := NewCLI(&buf, true, true)
	r.OnRequest(0, makeResult("GET /", []sandbox.TestResult{{Name: "OK", Passed: true}},
		makeResponse(200, "200 OK", []byte(`{"key":"value"}`), 5*time.Millisecond)))
	assert.Contains(t, buf.String(), `{"key":"value"}`)
}

// ── Multi reporter ────────────────────────────────────────────────────────────

func TestMulti_FansOut(t *testing.T) {
	var buf1, buf2 bytes.Buffer
	m := NewMulti(NewCLI(&buf1, true, false), NewCLI(&buf2, true, false))
	m.OnStart("Col")
	assert.Contains(t, buf1.String(), "Col")
	assert.Contains(t, buf2.String(), "Col")
}

func TestMulti_Empty(t *testing.T) {
	m := NewMulti()
	m.OnStart("X")
	m.OnRequest(0, runner.RequestResult{Name: "R"})
	m.OnDone(makeRun("X", makeIter(0)))
}

func TestMulti_OnRequest_FansOut(t *testing.T) {
	var buf1, buf2 bytes.Buffer
	m := NewMulti(NewCLI(&buf1, true, false), NewCLI(&buf2, true, false))
	m.OnRequest(0, makeResult("GET /ping", []sandbox.TestResult{{Name: "OK", Passed: true}},
		makeResponse(200, "200 OK", nil, 5*time.Millisecond)))
	assert.Contains(t, buf1.String(), "GET /ping")
	assert.Contains(t, buf2.String(), "GET /ping")
}

func TestMulti_OnDone_FansOut(t *testing.T) {
	var buf1, buf2 bytes.Buffer
	m := NewMulti(NewCLI(&buf1, true, false), NewCLI(&buf2, true, false))
	m.OnStart("Suite")
	result := makeRun("Suite", makeIter(
		0,
		makeResult("R", []sandbox.TestResult{{Name: "T", Passed: true}},
			makeResponse(200, "200 OK", nil, 5*time.Millisecond)),
	))
	m.OnDone(result)
	assert.Contains(t, buf1.String(), "Suite")
	assert.Contains(t, buf2.String(), "Suite")
}

// ── JSON reporter — file and stdout paths ─────────────────────────────────────

func TestJSON_OnRequest_IsNoOp(t *testing.T) {
	var buf bytes.Buffer
	r := NewJSONWriter(&buf)
	r.OnStart("Col")
	r.OnRequest(0, makeResult("GET /ping", nil, makeResponse(200, "200 OK", nil, 5*time.Millisecond)))
	r.OnDone(makeRun("Col", makeIter(0)))
	var report jsonReport
	require.NoError(t, json.Unmarshal(buf.Bytes(), &report))
	assert.Equal(t, "Col", report.Collection)
}

func TestJSON_Writer_File(t *testing.T) {
	path := filepath.Join(t.TempDir(), "report.json")
	r := NewJSON(path)
	r.OnStart("FileCol")
	r.OnDone(makeRun("FileCol", makeIter(
		0,
		makeResult("GET /ok", []sandbox.TestResult{{Name: "Status 200", Passed: true}},
			makeResponse(200, "200 OK", nil, 10*time.Millisecond)),
	)))
	data, err := os.ReadFile(path) //nolint:gosec // path from t.TempDir()
	require.NoError(t, err)
	var report jsonReport
	require.NoError(t, json.Unmarshal(data, &report))
	assert.Equal(t, "FileCol", report.Collection)
}

func TestJSON_Writer_Stdout(t *testing.T) {
	r := NewJSON("-")
	r.OnStart("StdoutCol")
	r.OnDone(makeRun("StdoutCol", makeIter(0)))
}

// ── JUnit reporter — file and stdout paths ────────────────────────────────────

func TestJUnit_OnRequest_IsNoOp(t *testing.T) {
	var buf bytes.Buffer
	r := NewJUnitWriter(&buf)
	r.OnStart("Col")
	r.OnRequest(0, makeResult("GET /ping", nil, makeResponse(200, "200 OK", nil, 5*time.Millisecond)))
	r.OnDone(makeRun("Col", makeIter(0)))
	assert.True(t, strings.HasPrefix(buf.String(), "<?xml version="))
}

func TestJUnit_Writer_File(t *testing.T) {
	path := filepath.Join(t.TempDir(), "report.xml")
	r := NewJUnit(path)
	r.OnStart("FileCol")
	r.OnDone(makeRun("FileCol", makeIter(
		0,
		makeResult("GET /ok", []sandbox.TestResult{{Name: "Status 200", Passed: true}},
			makeResponse(200, "200 OK", nil, 10*time.Millisecond)),
	)))
	data, err := os.ReadFile(path) //nolint:gosec // path from t.TempDir()
	require.NoError(t, err)
	assert.Contains(t, string(data), `<testsuites`)
	assert.Contains(t, string(data), `name="FileCol"`)
}

func TestJUnit_Writer_Stdout(t *testing.T) {
	r := NewJUnit("-")
	r.OnStart("StdoutCol")
	r.OnDone(makeRun("StdoutCol", makeIter(0)))
}

// ── responseSummary ───────────────────────────────────────────────────────────

func TestResponseSummary_Nil(t *testing.T) {
	assert.Equal(t, "", responseSummary(nil))
}

func TestResponseSummary_Bytes(t *testing.T) {
	s := responseSummary(makeResponse(200, "200 OK", make([]byte, 512), 100*time.Millisecond))
	assert.Contains(t, s, "200 OK")
	assert.Contains(t, s, "512 B")
	assert.Contains(t, s, "100ms")
}

func TestResponseSummary_Kilobytes(t *testing.T) {
	s := responseSummary(makeResponse(200, "200 OK", make([]byte, 2048), 50*time.Millisecond))
	assert.Contains(t, s, "2 kB")
}

// ── OnRequest no-ops (JSON and JUnit) ─────────────────────────────────────────

func TestJSON_OnRequest_IsNoop(t *testing.T) {
	var buf bytes.Buffer
	r := NewJSONWriter(&buf)
	r.OnRequest(0, makeResult("GET /ping", []sandbox.TestResult{{Name: "OK", Passed: true}},
		makeResponse(200, "200 OK", nil, 5*time.Millisecond)))
	assert.Empty(t, buf.String(), "OnRequest must not write anything for JSON reporter")
}

func TestJUnit_OnRequest_IsNoop(t *testing.T) {
	var buf bytes.Buffer
	r := NewJUnitWriter(&buf)
	r.OnRequest(0, makeResult("GET /ping", []sandbox.TestResult{{Name: "OK", Passed: true}},
		makeResponse(200, "200 OK", nil, 5*time.Millisecond)))
	assert.Empty(t, buf.String(), "OnRequest must not write anything for JUnit reporter")
}

// ── OnDone writes to file path ────────────────────────────────────────────────

func TestJSON_OnDone_WritesToFilePath(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "report.json")
	r := NewJSON(path)
	r.OnStart("Col")
	r.OnDone(makeRun("Col", makeIter(0, makeResult("R", []sandbox.TestResult{
		{Name: "T", Passed: true},
	}, makeResponse(200, "200 OK", nil, 10*time.Millisecond)))))

	data, err := os.ReadFile(path) //nolint:gosec // test-only temp path
	require.NoError(t, err)
	assert.Contains(t, string(data), `"collection"`)
}

func TestJSON_OnDone_InvalidPath_WritesToStderr(t *testing.T) {
	r := NewJSON("/nonexistent_dir_9x8y7z/report.json")
	r.OnStart("Col")
	r.OnDone(makeRun("Col", makeIter(0)))
	// No panic; error is logged to stderr.
}

func TestJUnit_OnDone_WritesToFilePath(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "report.xml")
	r := NewJUnit(path)
	r.OnStart("Col")
	r.OnDone(makeRun("Col", makeIter(0, makeResult("R", []sandbox.TestResult{
		{Name: "T", Passed: true},
	}, makeResponse(200, "200 OK", nil, 10*time.Millisecond)))))

	data, err := os.ReadFile(path) //nolint:gosec // test-only temp path
	require.NoError(t, err)
	assert.Contains(t, string(data), "testsuites")
}

func TestJUnit_OnDone_InvalidPath_WritesToStderr(t *testing.T) {
	r := NewJUnit("/nonexistent_dir_9x8y7z/report.xml")
	r.OnStart("Col")
	r.OnDone(makeRun("Col", makeIter(0)))
	// No panic; error is logged to stderr.
}

func TestJSONReporter_OnRequest_IsNoOp(t *testing.T) {
	r := NewJSON("-")
	// OnRequest is a deliberate no-op: JSON reporter buffers the full run and
	// only serialises on OnDone. Verify that calling it does not panic.
	r.OnRequest(0, runner.RequestResult{})
}

func TestJUnitReporter_OnRequest_IsNoOp(t *testing.T) {
	r := NewJUnit("-")
	// OnRequest is a deliberate no-op: JUnit reporter buffers the full run and
	// only serialises on OnDone. Verify that calling it does not panic.
	r.OnRequest(0, runner.RequestResult{})
}

// ── CLI.OnDone — skipped request branch ──────────────────────────────────────

// TestCLI_OnDone_SkippedRequest covers the req.Skipped=true branch inside
// OnDone: skipped requests must not be counted in totalReq or failedReq.
func TestCLI_OnDone_SkippedRequest(t *testing.T) {
	var buf bytes.Buffer
	r := NewCLI(&buf, true, false)
	r.OnStart("Col")
	r.OnDone(makeRun("Col", makeIter(
		0,
		runner.RequestResult{Name: "Skip me", Skipped: true},
		makeResult("Normal", []sandbox.TestResult{{Name: "T", Passed: true}},
			makeResponse(200, "200 OK", nil, 5*time.Millisecond)),
	)))
	out := buf.String()
	// Only 1 request counted (the non-skipped one).
	assert.Contains(t, out, "1 executed")
	assert.NotContains(t, out, "2 executed")
}

// ── responseSummary — fractional kB ─────────────────────────────────────────

// TestResponseSummary_FractionalKilobytes covers the fsize != int(fsize) branch
// (line 160 in cli.go), exercised with a body that is not a multiple of 1024.
func TestResponseSummary_FractionalKilobytes(t *testing.T) {
	// 1536 bytes = 1.5 kB (not an integer number of kB)
	s := responseSummary(makeResponse(200, "200 OK", make([]byte, 1536), 25*time.Millisecond))
	assert.Contains(t, s, "1.5 kB")
}

// ── JSON.OnDone — Encode error via failing writer ────────────────────────────

// failWriter is an io.Writer that always returns an error, used to exercise
// the enc.Encode error branch in JSON.OnDone.
type failWriter struct{}

func (failWriter) Write(_ []byte) (int, error) { return 0, errors.New("write failure") }

// TestJSON_OnDone_EncodeError verifies that a write error during JSON encoding
// does not panic and is handled gracefully (logged to stderr).
func TestJSON_OnDone_EncodeError(t *testing.T) {
	r := NewJSONWriter(failWriter{})
	r.OnStart("Col")
	// Must not panic even when every write to the underlying writer fails.
	r.OnDone(makeRun("Col", makeIter(0)))
}

// ── JUnit.OnDone — header write error and encode error ───────────────────────

// TestJUnit_OnDone_HeaderWriteError verifies that a write error on the XML
// header line does not panic.
func TestJUnit_OnDone_HeaderWriteError(t *testing.T) {
	r := NewJUnitWriter(failWriter{})
	r.OnStart("Col")
	r.OnDone(makeRun("Col", makeIter(0)))
}

// TestJUnit_OnDone_EncodeError verifies that a write error during XML encoding
// does not panic (after the header write succeeds).
// We use a writer that fails only after N bytes to let the header through.
type writeAfterNFailer struct {
	written int
	failAt  int
}

func (w *writeAfterNFailer) Write(p []byte) (int, error) {
	if w.written >= w.failAt {
		return 0, errors.New("write failure after n bytes")
	}
	n := len(p)
	if w.written+n > w.failAt {
		n = w.failAt - w.written
	}
	w.written += n
	return n, nil
}

func TestJUnit_OnDone_EncodeError(t *testing.T) {
	// xml.Header is ~39 bytes; let the first 60 bytes succeed, then fail.
	r := NewJUnitWriter(&writeAfterNFailer{failAt: 60})
	r.OnStart("Col")
	r.OnDone(makeRun("Col", makeIter(0)))
}
