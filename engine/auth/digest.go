package auth

import (
	"context"
	"crypto/md5" //nolint:gosec // MD5 required by RFC 2617 Digest auth
	"crypto/rand"
	"encoding/hex"
	"fmt"
	nethttp "net/http"
	"strings"

	"github.com/guillaumedelre/reqlet/engine/parser"
	"github.com/guillaumedelre/reqlet/engine/variables"
)

type digest struct {
	username string
	password string
}

func newDigest(params []parser.AuthParam) (*digest, error) {
	username := paramStr(params, "username")
	if username == "" {
		return nil, fmt.Errorf("digest: missing username param")
	}
	return &digest{
		username: username,
		password: paramStr(params, "password"),
	}, nil
}

// Apply is a no-op: credentials are injected by the transport returned by WrapTransport.
func (d *digest) Apply(_ context.Context, _ *nethttp.Request, _ *variables.Resolver) error {
	return nil
}

// WrapTransport returns a RoundTripper that handles the Digest challenge-response
// handshake automatically (RFC 2617).
func (d *digest) WrapTransport(rt nethttp.RoundTripper) nethttp.RoundTripper {
	return &digestTransport{inner: rt, username: d.username, password: d.password}
}

type digestTransport struct {
	inner    nethttp.RoundTripper
	username string
	password string
}

func (t *digestTransport) RoundTrip(req *nethttp.Request) (*nethttp.Response, error) {
	// Preserve GetBody so the body can be replayed on retry.
	getBody := req.GetBody

	resp, err := t.inner.RoundTrip(req)
	if err != nil || resp.StatusCode != nethttp.StatusUnauthorized {
		return resp, err
	}

	wwwAuth := resp.Header.Get("WWW-Authenticate")
	if !strings.HasPrefix(wwwAuth, "Digest ") {
		return resp, nil
	}
	_ = resp.Body.Close()

	challenge := parseDigestChallenge(wwwAuth[len("Digest "):])
	realm := challenge["realm"]
	nonce := challenge["nonce"]
	algo := challenge["algorithm"]
	if algo == "" {
		algo = "MD5"
	}
	qop := challenge["qop"]

	uri := req.URL.RequestURI()
	cnonce := digestRandomHex(8)
	nc := "00000001"

	ha1 := digestMD5(t.username + ":" + realm + ":" + t.password)
	if strings.EqualFold(algo, "MD5-sess") {
		ha1 = digestMD5(ha1 + ":" + nonce + ":" + cnonce)
	}
	ha2 := digestMD5(req.Method + ":" + uri)

	var responseHash string
	if qop == "auth" || qop == "auth-int" {
		responseHash = digestMD5(ha1 + ":" + nonce + ":" + nc + ":" + cnonce + ":" + qop + ":" + ha2)
	} else {
		responseHash = digestMD5(ha1 + ":" + nonce + ":" + ha2)
	}

	authHeader := fmt.Sprintf(
		`Digest username=%q, realm=%q, nonce=%q, uri=%q, algorithm=%s, response=%q`,
		t.username, realm, nonce, uri, algo, responseHash,
	)
	if qop != "" {
		authHeader += fmt.Sprintf(`, qop=%s, nc=%s, cnonce=%q`, qop, nc, cnonce)
	}

	clone := req.Clone(req.Context())
	clone.Header.Set("Authorization", authHeader)
	if getBody != nil {
		body, err := getBody()
		if err != nil {
			return nil, fmt.Errorf("digest: replay body: %w", err)
		}
		clone.Body = body
	}
	return t.inner.RoundTrip(clone)
}

// parseDigestChallenge parses the comma-separated key=value pairs from a
// WWW-Authenticate: Digest header value (after the "Digest " prefix).
func parseDigestChallenge(s string) map[string]string {
	params := make(map[string]string)
	for _, part := range strings.Split(s, ",") {
		part = strings.TrimSpace(part)
		idx := strings.IndexByte(part, '=')
		if idx < 0 {
			continue
		}
		key := strings.TrimSpace(part[:idx])
		val := strings.Trim(strings.TrimSpace(part[idx+1:]), `"`)
		params[key] = val
	}
	return params
}

func digestMD5(s string) string {
	h := md5.Sum([]byte(s)) //nolint:gosec // MD5 required by RFC 2617
	return hex.EncodeToString(h[:])
}

func digestRandomHex(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
