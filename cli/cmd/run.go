package cmd

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/spf13/cobra"

	enginehttp "github.com/guillaumedelre/reqlet/engine/http"
	"github.com/guillaumedelre/reqlet/engine/loader"
	"github.com/guillaumedelre/reqlet/engine/parser"
	"github.com/guillaumedelre/reqlet/engine/reporter"
	"github.com/guillaumedelre/reqlet/engine/runner"
	"github.com/guillaumedelre/reqlet/engine/sandbox"
)

var runCmd = &cobra.Command{
	Use:   "run <collection>",
	Short: "Run a Postman collection",
	Args:  cobra.ExactArgs(1),
	RunE:  runCollection,
}

// flag values
var (
	flagEnvironment      string
	flagGlobals          string
	flagData             string
	flagIterations       int
	flagDelayRequest     int
	flagTimeout          int
	flagTimeoutReq       int
	flagFolder           string
	flagBail             bool
	flagInsecure         bool
	flagNoColor          bool
	flagVerbose          bool
	flagEnvVar           []string
	flagGlobalVar        []string
	flagReporterJSON     string
	flagReporterJUnit    string
	flagRunner           string
	flagClientCert       string
	flagClientKey        string
	flagClientPassphrase string
)

func init() {
	f := runCmd.Flags()
	f.StringVar(&flagEnvironment, "environment", "", "path to environment file")
	f.StringVar(&flagGlobals, "globals", "", "path to globals file")
	f.StringVar(&flagData, "data", "", "path to data file (CSV or JSON)")
	f.IntVar(&flagIterations, "iteration-count", 1, "number of iterations")
	f.IntVar(&flagDelayRequest, "delay-request", 0, "delay between requests in milliseconds")
	f.IntVar(&flagTimeout, "timeout", 0, "overall run timeout in seconds (0 = no limit)")
	f.IntVar(&flagTimeoutReq, "timeout-request", 30, "per-request timeout in seconds")
	f.StringVar(&flagFolder, "folder", "", "run only requests in this folder")
	f.BoolVar(&flagBail, "bail", false, "stop on first failed test")
	f.BoolVar(&flagInsecure, "insecure", false, "skip TLS certificate verification")
	f.BoolVar(&flagNoColor, "no-color", false, "disable terminal colours")
	f.BoolVar(&flagVerbose, "verbose", false, "print response body for each request")
	f.StringArrayVar(&flagEnvVar, "env-var", nil, "set environment variable (key=value)")
	f.StringArrayVar(&flagGlobalVar, "global-var", nil, "set global variable (key=value)")
	f.StringVar(&flagReporterJSON, "reporter-json-export", "", "write JSON report to file (- for stdout)")
	f.StringVar(&flagReporterJUnit, "reporter-junit-export", "", "write JUnit XML report to file (- for stdout)")
	f.StringVar(&flagRunner, "runner", "", "path to runner/src/index.js (overrides REQLET_RUNNER)")
	f.StringVar(&flagClientCert, "ssl-client-cert", "", "path to PEM client certificate file")
	f.StringVar(&flagClientKey, "ssl-client-key", "", "path to PEM client private key file")
	f.StringVar(&flagClientPassphrase, "ssl-client-passphrase", "", "passphrase for encrypted client key")
}

func runCollection(cmd *cobra.Command, args []string) error {
	collectionPath := args[0]

	// Load collection
	col, err := loadCollection(collectionPath)
	if err != nil {
		return err
	}

	// Load environment (optional)
	env, err := loadEnvironment(flagEnvironment)
	if err != nil {
		return err
	}

	// Apply --env-var overrides on top of the loaded environment
	if len(flagEnvVar) > 0 {
		extra, err := parseKV(flagEnvVar)
		if err != nil {
			return fmt.Errorf("--env-var: %w", err)
		}
		if env == nil {
			env = &parser.Environment{}
		}
		for k, v := range extra {
			env.Values = append(env.Values, parser.EnvironmentValue{Key: k, Value: v, Enabled: true})
		}
	}

	// Global vars: load file then apply --global-var overrides
	globalVars := make(map[string]string)
	if flagGlobals != "" {
		genv, err := loadEnvironment(flagGlobals)
		if err != nil {
			return fmt.Errorf("globals: %w", err)
		}
		if genv != nil {
			for _, v := range genv.Values {
				if v.Enabled {
					globalVars[v.Key] = v.Value
				}
			}
		}
	}
	if len(flagGlobalVar) > 0 {
		extra, err := parseKV(flagGlobalVar)
		if err != nil {
			return fmt.Errorf("--global-var: %w", err)
		}
		for k, v := range extra {
			globalVars[k] = v
		}
	}

	// Load data file (optional)
	data, err := loadData(flagData)
	if err != nil {
		return err
	}

	// HTTP client
	httpOpts := enginehttp.DefaultOptions()
	httpOpts.Timeout = time.Duration(flagTimeoutReq) * time.Second
	httpOpts.Insecure = flagInsecure
	httpOpts.ClientCertFile = flagClientCert
	httpOpts.ClientKeyFile = flagClientKey
	httpOpts.ClientPassphrase = flagClientPassphrase
	httpClient, err := enginehttp.NewClient(httpOpts)
	if err != nil {
		return fmt.Errorf("http client: %w", err)
	}

	// Sandbox
	scriptPath, err := resolveRunner(flagRunner)
	if err != nil {
		return err
	}
	sb, err := sandbox.NewRunner(scriptPath)
	if err != nil {
		return fmt.Errorf("sandbox: %w", err)
	}
	defer func() { _ = sb.Close() }()

	// Reporters
	reporters := []reporter.Reporter{
		reporter.NewCLI(cmd.OutOrStdout(), flagNoColor, flagVerbose),
	}
	if flagReporterJSON != "" {
		reporters = append(reporters, reporter.NewJSON(flagReporterJSON))
	}
	if flagReporterJUnit != "" {
		reporters = append(reporters, reporter.NewJUnit(flagReporterJUnit))
	}
	rep := reporter.NewMulti(reporters...)

	// Context
	ctx := context.Background()
	if flagTimeout > 0 {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, time.Duration(flagTimeout)*time.Second)
		defer cancel()
	}

	// Build runner options
	opts := runner.Options{
		Iterations:   flagIterations,
		DelayMS:      flagDelayRequest,
		Folder:       flagFolder,
		Bail:         flagBail,
		Data:         data,
		SaveResponse: true,
		GlobalVars:   globalVars,
		OnRequest:    rep.OnRequest,
	}

	r := runner.New(httpClient, sb)
	rep.OnStart(col.Info.Name)

	result, err := r.Run(ctx, col, env, opts)
	if err != nil {
		return err
	}

	rep.OnDone(result)

	if !result.Passed() {
		os.Exit(1)
	}
	return nil
}

// loadCollection reads and loads a Postman collection file (v1.0, v2.0 or v2.1).
func loadCollection(path string) (*parser.Collection, error) {
	f, err := os.Open(path) //nolint:gosec // path provided by user
	if err != nil {
		return nil, fmt.Errorf("open collection %q: %w", path, err)
	}
	defer func() { _ = f.Close() }()

	col, err := loader.LoadCollection(f)
	if err != nil {
		return nil, fmt.Errorf("load collection %q: %w", path, err)
	}
	return col, nil
}

// loadEnvironment reads and parses a Postman environment file.
// Returns nil if path is empty.
func loadEnvironment(path string) (*parser.Environment, error) {
	if path == "" {
		return nil, nil
	}
	f, err := os.Open(path) //nolint:gosec // path provided by user
	if err != nil {
		return nil, fmt.Errorf("open environment %q: %w", path, err)
	}
	defer func() { _ = f.Close() }()

	env, err := loader.LoadEnvironment(f)
	if err != nil {
		return nil, fmt.Errorf("load environment %q: %w", path, err)
	}
	return env, nil
}

// loadData reads a CSV or JSON data file.
// Returns nil if path is empty.
func loadData(path string) ([]map[string]string, error) {
	if path == "" {
		return nil, nil
	}
	f, err := os.Open(path) //nolint:gosec // path provided by user
	if err != nil {
		return nil, fmt.Errorf("open data file %q: %w", path, err)
	}
	defer func() { _ = f.Close() }()

	rows, err := loader.LoadData(f, filepath.Ext(path))
	if err != nil {
		return nil, fmt.Errorf("load data %q: %w", path, err)
	}
	return rows, nil
}

// parseKV splits "key=value" strings into a map.
func parseKV(pairs []string) (map[string]string, error) {
	m := make(map[string]string, len(pairs))
	for _, p := range pairs {
		k, v, ok := strings.Cut(p, "=")
		if !ok {
			return nil, fmt.Errorf("expected key=value, got %q", p)
		}
		m[k] = v
	}
	return m, nil
}

// resolveRunner returns the path to the runner entry script.
// Priority: explicit flag > REQLET_RUNNER env var > standard locations.
func resolveRunner(flagPath string) (string, error) {
	if flagPath != "" {
		return flagPath, nil
	}
	if v := os.Getenv("REQLET_RUNNER"); v != "" {
		return v, nil
	}

	// Try relative to the executable
	exe, err := os.Executable()
	if err == nil {
		candidate := filepath.Join(filepath.Dir(exe), "..", "runner", "src", "index.js")
		if _, err := os.Stat(candidate); err == nil {
			return candidate, nil
		}
	}

	// Try relative to the working directory
	candidate := filepath.Join("runner", "src", "index.js")
	if _, err := os.Stat(candidate); err == nil {
		return candidate, nil
	}

	return "", fmt.Errorf("runner not found: set REQLET_RUNNER or use --runner")
}
