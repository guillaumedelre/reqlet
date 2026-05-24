// Package http provides the HTTP execution engine for Postman requests.
package http

import (
	"bytes"
	"context"
	"crypto/tls"
	"fmt"
	"io"
	"mime/multipart"
	nethttp "net/http"
	"net/url"
	"strings"
	"time"

	"github.com/guillaumedelre/reqlet/engine/auth"
	"github.com/guillaumedelre/reqlet/engine/parser"
	"github.com/guillaumedelre/reqlet/engine/variables"
)

// Options configures the HTTP client behaviour.
type Options struct {
	Timeout         time.Duration
	Insecure        bool // skip TLS certificate verification
	FollowRedirects bool
	ProxyURL        string
}

// DefaultOptions returns sensible defaults: 30 s timeout, TLS on, redirects on.
func DefaultOptions() Options {
	return Options{
		Timeout:         30 * time.Second,
		FollowRedirects: true,
	}
}

// Response holds the result of executing an HTTP request.
type Response struct {
	StatusCode int
	Status     string
	Proto      string
	Headers    nethttp.Header
	Body       []byte
	Duration   time.Duration
}

// Client executes Postman HTTP requests.
type Client struct {
	inner *nethttp.Client
}

// NewClient creates a Client configured with the provided options.
func NewClient(opts Options) (*Client, error) {
	transport := &nethttp.Transport{
		TLSClientConfig: &tls.Config{InsecureSkipVerify: opts.Insecure}, //nolint:gosec // controlled by caller
	}

	if opts.ProxyURL != "" {
		proxyURL, err := url.Parse(opts.ProxyURL)
		if err != nil {
			return nil, fmt.Errorf("invalid proxy URL %q: %w", opts.ProxyURL, err)
		}
		transport.Proxy = nethttp.ProxyURL(proxyURL)
	}

	inner := &nethttp.Client{
		Transport: transport,
		Timeout:   opts.Timeout,
	}

	if !opts.FollowRedirects {
		inner.CheckRedirect = func(_ *nethttp.Request, _ []*nethttp.Request) error {
			return nethttp.ErrUseLastResponse
		}
	}

	return &Client{inner: inner}, nil
}

// Execute sends a Postman request, resolving variables before dispatch.
// applier is optional: pass nil to send the request without authentication.
func (c *Client) Execute(ctx context.Context, req *parser.Request, vars *variables.Resolver, applier auth.Applier) (*Response, error) {
	rawURL := vars.Resolve(req.URL.Raw)

	body, contentType, err := buildBody(req.Body, vars)
	if err != nil {
		return nil, fmt.Errorf("build body: %w", err)
	}

	httpReq, err := nethttp.NewRequestWithContext(ctx, req.Method, rawURL, body)
	if err != nil {
		return nil, fmt.Errorf("build request: %w", err)
	}

	for _, h := range req.Header {
		if h.Disabled {
			continue
		}
		httpReq.Header.Set(vars.Resolve(h.Key), vars.Resolve(h.Value))
	}

	if contentType != "" && httpReq.Header.Get("Content-Type") == "" {
		httpReq.Header.Set("Content-Type", contentType)
	}

	// Apply authentication and optionally wrap the transport per-request.
	inner := c.inner
	if applier != nil {
		if tw, ok := applier.(auth.TransportWrapper); ok {
			clone := *c.inner
			clone.Transport = tw.WrapTransport(c.inner.Transport)
			inner = &clone
		}
		if err := applier.Apply(ctx, httpReq, vars); err != nil {
			return nil, fmt.Errorf("apply auth: %w", err)
		}
	}

	start := time.Now()
	resp, err := inner.Do(httpReq)
	duration := time.Since(start)
	if err != nil {
		return nil, fmt.Errorf("execute request: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response body: %w", err)
	}

	return &Response{
		StatusCode: resp.StatusCode,
		Status:     resp.Status,
		Proto:      resp.Proto,
		Headers:    resp.Header,
		Body:       respBody,
		Duration:   duration,
	}, nil
}

// buildBody converts a parser.Body into an io.Reader and the appropriate
// Content-Type header value. Returns nil reader for requests with no body.
func buildBody(b *parser.Body, vars *variables.Resolver) (io.Reader, string, error) {
	if b == nil {
		return nil, "", nil
	}

	switch b.Mode {
	case parser.BodyModeRaw:
		return strings.NewReader(vars.Resolve(b.Raw)), contentTypeForRaw(b), nil

	case parser.BodyModeURLEncoded:
		form := url.Values{}
		for _, p := range b.URLEncoded {
			if p.Disabled {
				continue
			}
			form.Set(vars.Resolve(p.Key), vars.Resolve(p.Value))
		}
		return strings.NewReader(form.Encode()), "application/x-www-form-urlencoded", nil

	case parser.BodyModeFormData:
		var buf bytes.Buffer
		w := multipart.NewWriter(&buf)
		for _, p := range b.FormData {
			if p.Disabled {
				continue
			}
			fw, err := w.CreateFormField(vars.Resolve(p.Key))
			if err != nil {
				return nil, "", fmt.Errorf("form field %q: %w", p.Key, err)
			}
			if _, err := fw.Write([]byte(vars.Resolve(p.Value))); err != nil {
				return nil, "", fmt.Errorf("write field %q: %w", p.Key, err)
			}
		}
		if err := w.Close(); err != nil {
			return nil, "", fmt.Errorf("close multipart writer: %w", err)
		}
		return &buf, w.FormDataContentType(), nil

	case parser.BodyModeGraphQL:
		if b.GraphQL == nil {
			return nil, "application/json", nil
		}
		payload := fmt.Sprintf(
			`{"query":%q,"variables":%s}`,
			vars.Resolve(b.GraphQL.Query),
			vars.Resolve(b.GraphQL.Variables),
		)
		return strings.NewReader(payload), "application/json", nil

	default:
		return nil, "", nil
	}
}

func contentTypeForRaw(b *parser.Body) string {
	if b.Options == nil || b.Options.Raw == nil {
		return "text/plain"
	}
	switch b.Options.Raw.Language {
	case "json":
		return "application/json"
	case "xml":
		return "application/xml"
	case "html":
		return "text/html"
	case "javascript":
		return "application/javascript"
	default:
		return "text/plain"
	}
}
