// Package http provides the HTTP execution engine for Postman requests.
package http

import (
	"bytes"
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"fmt"
	"io"
	"mime/multipart"
	nethttp "net/http"
	"net/http/httptrace"
	"net/url"
	"os"
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
	// ClientCertFile is the path to a PEM-encoded client certificate.
	// ClientKeyFile is the path to the corresponding PEM-encoded private key.
	// ClientPassphrase decrypts the private key if it is passphrase-protected.
	// All three fields are optional; if ClientCertFile is empty no client cert is sent.
	ClientCertFile   string
	ClientKeyFile    string
	ClientPassphrase string
}

// DefaultOptions returns sensible defaults: 30 s timeout, TLS on, redirects on.
func DefaultOptions() Options {
	return Options{
		Timeout:         30 * time.Second,
		FollowRedirects: true,
	}
}

// Timings holds the measured duration of each phase of an HTTP request.
// A zero value means the phase did not occur (e.g. DNS for a reused connection).
type Timings struct {
	DNS      time.Duration // DNS lookup
	TCP      time.Duration // TCP connection establishment
	TLS      time.Duration // TLS handshake
	TTFB     time.Duration // time from request written to first response byte
	Download time.Duration // time to read the full response body
	Total    time.Duration // end-to-end wall clock time
}

// Response holds the result of executing an HTTP request.
type Response struct {
	StatusCode int
	Status     string
	Proto      string
	Headers    nethttp.Header
	Body       []byte
	Duration   time.Duration
	Timings    Timings
}

// timingCollector records httptrace event timestamps for a single request.
type timingCollector struct {
	dnsStart     time.Time
	dnsDone      time.Time
	tcpStart     time.Time
	tcpDone      time.Time
	tlsStart     time.Time
	tlsDone      time.Time
	wroteRequest time.Time
	firstByte    time.Time
}

func (tc *timingCollector) clientTrace() *httptrace.ClientTrace {
	return &httptrace.ClientTrace{
		DNSStart:             func(_ httptrace.DNSStartInfo) { tc.dnsStart = time.Now() },
		DNSDone:              func(_ httptrace.DNSDoneInfo) { tc.dnsDone = time.Now() },
		ConnectStart:         func(_, _ string) { tc.tcpStart = time.Now() },
		ConnectDone:          func(_, _ string, _ error) { tc.tcpDone = time.Now() },
		TLSHandshakeStart:    func() { tc.tlsStart = time.Now() },
		TLSHandshakeDone:     func(_ tls.ConnectionState, _ error) { tc.tlsDone = time.Now() },
		WroteRequest:         func(_ httptrace.WroteRequestInfo) { tc.wroteRequest = time.Now() },
		GotFirstResponseByte: func() { tc.firstByte = time.Now() },
	}
}

func (tc *timingCollector) build(total, download time.Duration) Timings {
	phaseDur := func(start, end time.Time) time.Duration {
		if start.IsZero() || end.IsZero() {
			return 0
		}
		return end.Sub(start)
	}
	return Timings{
		DNS:      phaseDur(tc.dnsStart, tc.dnsDone),
		TCP:      phaseDur(tc.tcpStart, tc.tcpDone),
		TLS:      phaseDur(tc.tlsStart, tc.tlsDone),
		TTFB:     phaseDur(tc.wroteRequest, tc.firstByte),
		Download: download,
		Total:    total,
	}
}

// Client executes Postman HTTP requests.
type Client struct {
	inner *nethttp.Client
}

// NewClient creates a Client configured with the provided options.
func NewClient(opts Options) (*Client, error) {
	tlsCfg := &tls.Config{InsecureSkipVerify: opts.Insecure} //nolint:gosec // controlled by caller

	if opts.ClientCertFile != "" {
		cert, err := loadClientCert(opts.ClientCertFile, opts.ClientKeyFile, opts.ClientPassphrase)
		if err != nil {
			return nil, fmt.Errorf("load client certificate: %w", err)
		}
		tlsCfg.Certificates = []tls.Certificate{cert}
	}

	transport := &nethttp.Transport{
		TLSClientConfig: tlsCfg,
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

	tc := &timingCollector{}
	tracedCtx := httptrace.WithClientTrace(ctx, tc.clientTrace())

	httpReq, err := nethttp.NewRequestWithContext(tracedCtx, req.Method, rawURL, body)
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
		if err := applier.Apply(tracedCtx, httpReq, vars); err != nil {
			return nil, fmt.Errorf("apply auth: %w", err)
		}
	}

	start := time.Now()
	resp, err := inner.Do(httpReq)
	total := time.Since(start)
	if err != nil {
		return nil, fmt.Errorf("execute request: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	dlStart := time.Now()
	respBody, err := io.ReadAll(resp.Body)
	download := time.Since(dlStart)
	if err != nil {
		return nil, fmt.Errorf("read response body: %w", err)
	}

	return &Response{
		StatusCode: resp.StatusCode,
		Status:     resp.Status,
		Proto:      resp.Proto,
		Headers:    resp.Header,
		Body:       respBody,
		Duration:   total,
		Timings:    tc.build(total, download),
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
			if p.Type == "file" {
				filename := p.Src
				if filename == "" {
					filename = p.Key
				}
				fw, err := w.CreateFormFile(vars.Resolve(p.Key), filename)
				if err != nil {
					return nil, "", fmt.Errorf("form file %q: %w", p.Key, err)
				}
				data, err := decodeBase64(p.Value)
				if err != nil {
					return nil, "", fmt.Errorf("decode file %q: %w", p.Key, err)
				}
				if _, err := fw.Write(data); err != nil {
					return nil, "", fmt.Errorf("write file %q: %w", p.Key, err)
				}
			} else {
				fw, err := w.CreateFormField(vars.Resolve(p.Key))
				if err != nil {
					return nil, "", fmt.Errorf("form field %q: %w", p.Key, err)
				}
				if _, err := fw.Write([]byte(vars.Resolve(p.Value))); err != nil {
					return nil, "", fmt.Errorf("write field %q: %w", p.Key, err)
				}
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

// loadClientCert loads a PEM client certificate and its private key.
// keyFile may be empty when the key is embedded in certFile.
// passphrase decrypts an encrypted private key block; leave empty for unencrypted keys.
func loadClientCert(certFile, keyFile, passphrase string) (tls.Certificate, error) {
	certPEM, err := os.ReadFile(certFile) //nolint:gosec // path provided by caller
	if err != nil {
		return tls.Certificate{}, fmt.Errorf("read cert %q: %w", certFile, err)
	}

	var keyPEM []byte
	if keyFile != "" {
		keyPEM, err = os.ReadFile(keyFile) //nolint:gosec // path provided by caller
		if err != nil {
			return tls.Certificate{}, fmt.Errorf("read key %q: %w", keyFile, err)
		}
	} else {
		keyPEM = certPEM
	}

	if passphrase != "" {
		keyPEM, err = decryptPEMKey(keyPEM, []byte(passphrase))
		if err != nil {
			return tls.Certificate{}, fmt.Errorf("decrypt key: %w", err)
		}
	}

	cert, err := tls.X509KeyPair(certPEM, keyPEM)
	if err != nil {
		return tls.Certificate{}, fmt.Errorf("parse cert/key pair: %w", err)
	}
	return cert, nil
}

// decryptPEMKey decrypts the first encrypted PEM block found in data and returns
// a new PEM-encoded byte slice with the decrypted key.
// If no encrypted block is found, the original data is returned unchanged.
func decryptPEMKey(data, passphrase []byte) ([]byte, error) {
	remaining := data
	for {
		block, rest := pem.Decode(remaining)
		if block == nil {
			break
		}
		//nolint:staticcheck // x509.DecryptPEMBlock is deprecated but still the standard way
		if x509.IsEncryptedPEMBlock(block) {
			der, err := x509.DecryptPEMBlock(block, passphrase) //nolint:staticcheck
			if err != nil {
				return nil, fmt.Errorf("decrypt PEM block %q: %w", block.Type, err)
			}
			return pem.EncodeToMemory(&pem.Block{Type: block.Type, Bytes: der}), nil
		}
		remaining = rest
	}
	return data, nil
}

func decodeBase64(s string) ([]byte, error) {
	if data, err := base64.StdEncoding.DecodeString(s); err == nil {
		return data, nil
	}
	return base64.RawStdEncoding.DecodeString(s)
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
