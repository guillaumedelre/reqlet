package http

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"errors"
	"io"
	"math/big"
	"mime"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/guillaumedelre/reqlet/engine/auth"
	"github.com/guillaumedelre/reqlet/engine/parser"
	"github.com/guillaumedelre/reqlet/engine/variables"
)

// ── helpers ───────────────────────────────────────────────────────────────────

func newClient(t *testing.T) *Client {
	t.Helper()
	c, err := NewClient(DefaultOptions())
	require.NoError(t, err)
	return c
}

func newVars(kvs ...string) *variables.Resolver {
	r := variables.NewResolver()
	for i := 0; i+1 < len(kvs); i += 2 {
		r.Set(variables.ScopeEnvironment, kvs[i], kvs[i+1])
	}
	return r
}

func parseRequest(method, rawURL string) *parser.Request {
	return &parser.Request{Method: method, URL: parser.URL{Raw: rawURL}}
}

// ── NewClient ─────────────────────────────────────────────────────────────────

func TestNewClient_Default(t *testing.T) {
	c, err := NewClient(DefaultOptions())
	require.NoError(t, err)
	require.NotNil(t, c)
}

func TestNewClient_InvalidProxy(t *testing.T) {
	_, err := NewClient(Options{ProxyURL: "://bad-url"})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "invalid proxy URL")
}

// ── GET ───────────────────────────────────────────────────────────────────────

func TestExecute_GET(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, http.MethodGet, r.Method)
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"ok":true}`))
	}))
	defer srv.Close()

	c := newClient(t)
	resp, err := c.Execute(context.Background(), parseRequest("GET", srv.URL+"/ping"), newVars(), nil)
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp.StatusCode)
	assert.JSONEq(t, `{"ok":true}`, string(resp.Body))
	assert.Positive(t, resp.Duration)
}

func TestExecute_VariablesResolvedInURL(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "/articles/42", r.URL.Path)
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	c := newClient(t)
	req := parseRequest("GET", "{{base_url}}/articles/{{id}}")
	vars := newVars("base_url", srv.URL, "id", "42")
	resp, err := c.Execute(context.Background(), req, vars, nil)
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp.StatusCode)
}

func TestExecute_Headers(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "application/json", r.Header.Get("Accept"))
		assert.Equal(t, "Bearer test-token", r.Header.Get("Authorization"))
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	c := newClient(t)
	req := &parser.Request{
		Method: "GET",
		URL:    parser.URL{Raw: srv.URL},
		Header: []parser.Header{
			{Key: "Accept", Value: "application/json"},
			{Key: "Authorization", Value: "Bearer {{token}}"},
		},
	}
	vars := newVars("token", "test-token")
	resp, err := c.Execute(context.Background(), req, vars, nil)
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp.StatusCode)
}

func TestExecute_DisabledHeaderSkipped(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Empty(t, r.Header.Get("X-Debug"))
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	c := newClient(t)
	req := &parser.Request{
		Method: "GET",
		URL:    parser.URL{Raw: srv.URL},
		Header: []parser.Header{
			{Key: "X-Debug", Value: "1", Disabled: true},
		},
	}
	resp, err := c.Execute(context.Background(), req, newVars(), nil)
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp.StatusCode)
}

// ── Methods ───────────────────────────────────────────────────────────────────

func TestExecute_Methods(t *testing.T) {
	methods := []string{"GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"}
	for _, method := range methods {
		t.Run(method, func(t *testing.T) {
			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				assert.Equal(t, method, r.Method)
				w.WriteHeader(http.StatusOK)
			}))
			defer srv.Close()

			c := newClient(t)
			resp, err := c.Execute(context.Background(), parseRequest(method, srv.URL), newVars(), nil)
			require.NoError(t, err)
			assert.Equal(t, http.StatusOK, resp.StatusCode)
		})
	}
}

// ── Body modes ────────────────────────────────────────────────────────────────

func TestExecute_RawJSONBody(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "application/json", r.Header.Get("Content-Type"))
		body, _ := io.ReadAll(r.Body)
		var payload map[string]interface{}
		require.NoError(t, json.Unmarshal(body, &payload))
		assert.Equal(t, "hello", payload["title"])
		w.WriteHeader(http.StatusCreated)
	}))
	defer srv.Close()

	c := newClient(t)
	req := &parser.Request{
		Method: "POST",
		URL:    parser.URL{Raw: srv.URL},
		Body: &parser.Body{
			Mode: parser.BodyModeRaw,
			Raw:  `{"title":"{{name}}"}`,
			Options: &parser.BodyOptions{
				Raw: &parser.RawOptions{Language: "json"},
			},
		},
	}
	vars := newVars("name", "hello")
	resp, err := c.Execute(context.Background(), req, vars, nil)
	require.NoError(t, err)
	assert.Equal(t, http.StatusCreated, resp.StatusCode)
}

func TestExecute_URLEncodedBody(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "application/x-www-form-urlencoded", r.Header.Get("Content-Type"))
		require.NoError(t, r.ParseForm())
		assert.Equal(t, "admin", r.FormValue("username"))
		assert.Equal(t, "secret", r.FormValue("password"))
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	c := newClient(t)
	req := &parser.Request{
		Method: "POST",
		URL:    parser.URL{Raw: srv.URL},
		Body: &parser.Body{
			Mode: parser.BodyModeURLEncoded,
			URLEncoded: []parser.URLEncodedParam{
				{Key: "username", Value: "admin"},
				{Key: "password", Value: "{{pass}}"},
				{Key: "disabled", Value: "skip", Disabled: true},
			},
		},
	}
	vars := newVars("pass", "secret")
	resp, err := c.Execute(context.Background(), req, vars, nil)
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp.StatusCode)
}

func TestExecute_FormDataBody(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ct := r.Header.Get("Content-Type")
		mediaType, params, err := mime.ParseMediaType(ct)
		require.NoError(t, err)
		assert.Equal(t, "multipart/form-data", mediaType)

		mr := multipart.NewReader(r.Body, params["boundary"])
		fields := map[string]string{}
		for {
			part, err := mr.NextPart()
			if err == io.EOF {
				break
			}
			require.NoError(t, err)
			b, _ := io.ReadAll(part)
			fields[part.FormName()] = string(b)
		}
		assert.Equal(t, "FR", fields["lang"])
		assert.Equal(t, "EXAMPLE", fields["brand"])
		assert.Empty(t, fields["disabled"])
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	c := newClient(t)
	req := &parser.Request{
		Method: "POST",
		URL:    parser.URL{Raw: srv.URL},
		Body: &parser.Body{
			Mode: parser.BodyModeFormData,
			FormData: []parser.FormDataParam{
				{Key: "lang", Value: "{{lang}}", Type: "text"},
				{Key: "brand", Value: "EXAMPLE", Type: "text"},
				{Key: "disabled", Value: "skip", Type: "text", Disabled: true},
			},
		},
	}
	vars := newVars("lang", "FR")
	resp, err := c.Execute(context.Background(), req, vars, nil)
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp.StatusCode)
}

func TestExecute_NoBody(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		assert.Empty(t, body)
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	c := newClient(t)
	resp, err := c.Execute(context.Background(), parseRequest("GET", srv.URL), newVars(), nil)
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp.StatusCode)
}

// ── TLS / redirects ───────────────────────────────────────────────────────────

func TestExecute_InsecureTLS(t *testing.T) {
	srv := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	c, err := NewClient(Options{Timeout: 5 * time.Second, Insecure: true})
	require.NoError(t, err)
	resp, err := c.Execute(context.Background(), parseRequest("GET", srv.URL), newVars(), nil)
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp.StatusCode)
}

func TestExecute_RedirectsFollowed(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/redirect" {
			http.Redirect(w, r, "/final", http.StatusFound)
			return
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	c, err := NewClient(Options{Timeout: 5 * time.Second, FollowRedirects: true})
	require.NoError(t, err)
	resp, err := c.Execute(context.Background(), parseRequest("GET", srv.URL+"/redirect"), newVars(), nil)
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp.StatusCode)
}

func TestExecute_RedirectsDisabled(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/redirect" {
			http.Redirect(w, r, "/final", http.StatusFound)
			return
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	c, err := NewClient(Options{Timeout: 5 * time.Second, FollowRedirects: false})
	require.NoError(t, err)
	resp, err := c.Execute(context.Background(), parseRequest("GET", srv.URL+"/redirect"), newVars(), nil)
	require.NoError(t, err)
	assert.Equal(t, http.StatusFound, resp.StatusCode)
}

// ── Error cases ───────────────────────────────────────────────────────────────

func TestExecute_InvalidURL(t *testing.T) {
	c := newClient(t)
	_, err := c.Execute(context.Background(), parseRequest("GET", "://bad"), newVars(), nil)
	require.Error(t, err)
}

func TestExecute_ContextCancelled(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	c := newClient(t)
	_, err := c.Execute(ctx, parseRequest("GET", srv.URL), newVars(), nil)
	require.Error(t, err)
}

func TestExecute_ResponseHeaders(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("X-Custom", "reqlet")
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	c := newClient(t)
	resp, err := c.Execute(context.Background(), parseRequest("GET", srv.URL), newVars(), nil)
	require.NoError(t, err)
	assert.Equal(t, "reqlet", resp.Headers.Get("X-Custom"))
}

// ── buildBody / contentTypeForRaw ────────────────────────────────────────────

func TestContentTypeForRaw(t *testing.T) {
	tests := []struct {
		lang     string
		expected string
	}{
		{"json", "application/json"},
		{"xml", "application/xml"},
		{"html", "text/html"},
		{"javascript", "application/javascript"},
		{"text", "text/plain"},
		{"", "text/plain"},
	}
	for _, tc := range tests {
		t.Run(tc.lang, func(t *testing.T) {
			b := &parser.Body{
				Mode: parser.BodyModeRaw,
				Options: &parser.BodyOptions{
					Raw: &parser.RawOptions{Language: tc.lang},
				},
			}
			assert.Equal(t, tc.expected, contentTypeForRaw(b))
		})
	}
}

func TestContentTypeForRaw_NoOptions(t *testing.T) {
	b := &parser.Body{Mode: parser.BodyModeRaw}
	assert.Equal(t, "text/plain", contentTypeForRaw(b))
}

func TestBuildBody_NilBody(t *testing.T) {
	r, ct, err := buildBody(nil, variables.NewResolver())
	require.NoError(t, err)
	assert.Nil(t, r)
	assert.Empty(t, ct)
}

func TestBuildBody_GraphQL(t *testing.T) {
	b := &parser.Body{
		Mode: parser.BodyModeGraphQL,
		GraphQL: &parser.GraphQLBody{
			Query:     "{ user { id } }",
			Variables: `{"id":1}`,
		},
	}
	r, ct, err := buildBody(b, variables.NewResolver())
	require.NoError(t, err)
	assert.Equal(t, "application/json", ct)
	body, _ := io.ReadAll(r)
	assert.Contains(t, string(body), "query")
}

func TestBuildBody_GraphQL_Nil(t *testing.T) {
	b := &parser.Body{Mode: parser.BodyModeGraphQL}
	r, ct, err := buildBody(b, variables.NewResolver())
	require.NoError(t, err)
	assert.Equal(t, "application/json", ct)
	assert.Nil(t, r)
}

func TestBuildBody_UnknownMode(t *testing.T) {
	b := &parser.Body{Mode: "file"}
	r, ct, err := buildBody(b, variables.NewResolver())
	require.NoError(t, err)
	assert.Nil(t, r)
	assert.Empty(t, ct)
}

// ── Proxy ─────────────────────────────────────────────────────────────────────

func TestNewClient_WithProxy(t *testing.T) {
	// Just verify client construction succeeds with a well-formed proxy URL.
	c, err := NewClient(Options{
		Timeout:  5 * time.Second,
		ProxyURL: "http://proxy.example.com:8080",
	})
	require.NoError(t, err)
	require.NotNil(t, c)
}

// ── Response fields ───────────────────────────────────────────────────────────

func TestExecute_ResponseFields(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusTeapot)
		_, _ = w.Write([]byte("I'm a teapot"))
	}))
	defer srv.Close()

	c := newClient(t)
	resp, err := c.Execute(context.Background(), parseRequest("GET", srv.URL), newVars(), nil)
	require.NoError(t, err)
	assert.Equal(t, http.StatusTeapot, resp.StatusCode)
	assert.Contains(t, resp.Status, "418")
	assert.NotEmpty(t, resp.Proto)
	assert.Equal(t, []byte("I'm a teapot"), resp.Body)
	assert.Positive(t, resp.Duration)
}

// ── URL encoding ─────────────────────────────────────────────────────────────

func TestURLEncoded_SpecialChars(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.NoError(t, r.ParseForm())
		assert.Equal(t, "hello world", r.FormValue("q"))
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	c := newClient(t)
	req := &parser.Request{
		Method: "POST",
		URL:    parser.URL{Raw: srv.URL},
		Body: &parser.Body{
			Mode: parser.BodyModeURLEncoded,
			URLEncoded: []parser.URLEncodedParam{
				{Key: "q", Value: "hello world"},
			},
		},
	}
	resp, err := c.Execute(context.Background(), req, newVars(), nil)
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp.StatusCode)
}

// ── Content-Type not overridden when caller sets it ──────────────────────────

func TestExecute_ContentTypeNotOverriddenByBodyMode(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "application/json; charset=utf-8", r.Header.Get("Content-Type"))
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	c := newClient(t)
	req := &parser.Request{
		Method: "POST",
		URL:    parser.URL{Raw: srv.URL},
		Header: []parser.Header{
			{Key: "Content-Type", Value: "application/json; charset=utf-8"},
		},
		Body: &parser.Body{
			Mode:    parser.BodyModeRaw,
			Raw:     `{}`,
			Options: &parser.BodyOptions{Raw: &parser.RawOptions{Language: "json"}},
		},
	}
	resp, err := c.Execute(context.Background(), req, newVars(), nil)
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp.StatusCode)
}

// ── Auth integration ──────────────────────────────────────────────────────────

func TestExecute_WithBearerApplier(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "Bearer test-token", r.Header.Get("Authorization"))
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	a, err := auth.New(&parser.Auth{
		Type:   parser.AuthTypeBearer,
		Bearer: []parser.AuthParam{{Key: "token", Value: "test-token"}},
	})
	require.NoError(t, err)

	c := newClient(t)
	resp, err := c.Execute(context.Background(), parseRequest("GET", srv.URL), newVars(), a)
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp.StatusCode)
}

func TestExecute_ApplierError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	c := newClient(t)
	_, err := c.Execute(context.Background(), parseRequest("GET", srv.URL), newVars(), &errorApplier{})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "apply auth")
}

func TestExecute_WithTransportWrapper(t *testing.T) {
	challenged := false
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") == "" {
			challenged = true
			w.Header().Set("WWW-Authenticate", `Digest realm="test", nonce="nonce123"`)
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	a, err := auth.New(&parser.Auth{
		Type: parser.AuthTypeDigest,
		Digest: []parser.AuthParam{
			{Key: "username", Value: "alice"},
			{Key: "password", Value: "secret"},
		},
	})
	require.NoError(t, err)

	c := newClient(t)
	resp, err := c.Execute(context.Background(), parseRequest("GET", srv.URL), newVars(), a)
	require.NoError(t, err)
	assert.True(t, challenged)
	assert.Equal(t, http.StatusOK, resp.StatusCode)
}

// ── TLS client certificates ───────────────────────────────────────────────────

// generateTestCert generates a self-signed ECDSA cert and key, writes them to
// separate PEM files in dir, and returns (certPath, keyPath).
func generateTestCert(t *testing.T, dir string) (certPath, keyPath string) {
	t.Helper()

	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	require.NoError(t, err)

	tmpl := &x509.Certificate{
		SerialNumber: big.NewInt(1),
		Subject:      pkix.Name{CommonName: "reqlet-test"},
		NotBefore:    time.Now().Add(-time.Hour),
		NotAfter:     time.Now().Add(time.Hour),
	}
	certDER, err := x509.CreateCertificate(rand.Reader, tmpl, tmpl, &key.PublicKey, key)
	require.NoError(t, err)

	certPath = filepath.Join(dir, "client.crt")
	keyPath = filepath.Join(dir, "client.key")

	certFile, err := os.Create(certPath) //nolint:gosec // path from t.TempDir()
	require.NoError(t, err)
	require.NoError(t, pem.Encode(certFile, &pem.Block{Type: "CERTIFICATE", Bytes: certDER}))
	require.NoError(t, certFile.Close())

	keyDER, err := x509.MarshalECPrivateKey(key)
	require.NoError(t, err)
	keyFile, err := os.Create(keyPath) //nolint:gosec // path from t.TempDir()
	require.NoError(t, err)
	require.NoError(t, pem.Encode(keyFile, &pem.Block{Type: "EC PRIVATE KEY", Bytes: keyDER}))
	require.NoError(t, keyFile.Close())

	return certPath, keyPath
}

func TestNewClient_ClientCertFile_NotFound(t *testing.T) {
	_, err := NewClient(Options{
		ClientCertFile: "/nonexistent/client.crt",
		ClientKeyFile:  "/nonexistent/client.key",
	})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "load client certificate")
}

func TestNewClient_ClientKeyFile_NotFound(t *testing.T) {
	dir := t.TempDir()
	certPath, _ := generateTestCert(t, dir)
	_, err := NewClient(Options{
		ClientCertFile: certPath,
		ClientKeyFile:  "/nonexistent/client.key",
	})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "load client certificate")
}

func TestNewClient_ValidClientCert(t *testing.T) {
	dir := t.TempDir()
	certPath, keyPath := generateTestCert(t, dir)
	c, err := NewClient(Options{
		ClientCertFile: certPath,
		ClientKeyFile:  keyPath,
	})
	require.NoError(t, err)
	require.NotNil(t, c)

	transport := c.inner.Transport.(*http.Transport)
	require.Len(t, transport.TLSClientConfig.Certificates, 1)
}

func TestNewClient_CertAndKeyInSameFile(t *testing.T) {
	dir := t.TempDir()
	certPath, keyPath := generateTestCert(t, dir)

	// Concatenate cert and key into a single PEM file.
	certData, err := os.ReadFile(certPath) //nolint:gosec // path from t.TempDir()
	require.NoError(t, err)
	keyData, err := os.ReadFile(keyPath) //nolint:gosec // path from t.TempDir()
	require.NoError(t, err)
	combinedPath := filepath.Join(dir, "combined.pem")
	require.NoError(t, os.WriteFile(combinedPath, append(certData, keyData...), 0o600)) //nolint:gosec // path from t.TempDir()

	c, err := NewClient(Options{ClientCertFile: combinedPath})
	require.NoError(t, err)
	transport := c.inner.Transport.(*http.Transport)
	require.Len(t, transport.TLSClientConfig.Certificates, 1)
}

func TestNewClient_InvalidKeyPair(t *testing.T) {
	dir1 := t.TempDir()
	dir2 := t.TempDir()
	cert1, _ := generateTestCert(t, dir1)
	_, key2 := generateTestCert(t, dir2)
	_, err := NewClient(Options{
		ClientCertFile: cert1,
		ClientKeyFile:  key2,
	})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "load client certificate")
}

func TestExecute_WithClientCert_TLSServer(t *testing.T) {
	dir := t.TempDir()
	certPath, keyPath := generateTestCert(t, dir)

	serverCert, err := tls.LoadX509KeyPair(certPath, keyPath)
	require.NoError(t, err)

	srv := httptest.NewUnstartedServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	srv.TLS = &tls.Config{
		Certificates: []tls.Certificate{serverCert},
		ClientAuth:   tls.RequestClientCert,
	}
	srv.StartTLS()
	defer srv.Close()

	c, err := NewClient(Options{
		Insecure:       true,
		ClientCertFile: certPath,
		ClientKeyFile:  keyPath,
	})
	require.NoError(t, err)
	resp, err := c.Execute(context.Background(), parseRequest("GET", srv.URL), newVars(), nil)
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp.StatusCode)
}

func TestDecryptPEMKey_Unencrypted(t *testing.T) {
	dir := t.TempDir()
	_, keyPath := generateTestCert(t, dir)
	data, err := os.ReadFile(keyPath) //nolint:gosec // path from t.TempDir()
	require.NoError(t, err)

	out, err := decryptPEMKey(data, []byte("ignored"))
	require.NoError(t, err)
	assert.Equal(t, data, out)
}

func TestDecryptPEMKey_EmptyInput(t *testing.T) {
	out, err := decryptPEMKey([]byte("not a pem block"), []byte("pass"))
	require.NoError(t, err)
	assert.Equal(t, []byte("not a pem block"), out)
}

// generateEncryptedKey generates a test ECDSA private key, encrypts it with
// passphrase using AES-256, and returns the encrypted PEM block.
func generateEncryptedKey(t *testing.T, passphrase []byte) []byte {
	t.Helper()
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	require.NoError(t, err)
	der, err := x509.MarshalECPrivateKey(key)
	require.NoError(t, err)
	//nolint:staticcheck // x509.EncryptPEMBlock is deprecated but still the standard way to generate encrypted PEM for tests
	block, err := x509.EncryptPEMBlock(rand.Reader, "EC PRIVATE KEY", der, passphrase, x509.PEMCipherAES256)
	require.NoError(t, err)
	return pem.EncodeToMemory(block)
}

func TestDecryptPEMKey_Encrypted_CorrectPassphrase(t *testing.T) {
	passphrase := []byte("correct-pass")
	encKey := generateEncryptedKey(t, passphrase)

	out, err := decryptPEMKey(encKey, passphrase)
	require.NoError(t, err)
	block, _ := pem.Decode(out)
	require.NotNil(t, block)
	assert.False(t, x509.IsEncryptedPEMBlock(block)) //nolint:staticcheck
}

func TestDecryptPEMKey_Encrypted_WrongPassphrase(t *testing.T) {
	encKey := generateEncryptedKey(t, []byte("correct"))
	_, err := decryptPEMKey(encKey, []byte("wrong"))
	require.Error(t, err)
	assert.Contains(t, err.Error(), "decrypt PEM block")
}

func TestLoadClientCert_WithPassphrase(t *testing.T) {
	dir := t.TempDir()
	certPath, keyPath := generateTestCert(t, dir)

	keyData, err := os.ReadFile(keyPath) //nolint:gosec // path from t.TempDir()
	require.NoError(t, err)
	block, _ := pem.Decode(keyData)
	require.NotNil(t, block)

	//nolint:staticcheck // x509.EncryptPEMBlock is deprecated but still the standard way to generate encrypted PEM for tests
	encBlock, err := x509.EncryptPEMBlock(rand.Reader, block.Type, block.Bytes, []byte("mypassphrase"), x509.PEMCipherAES256)
	require.NoError(t, err)
	encKeyPath := filepath.Join(dir, "enc.key")
	f, err := os.Create(encKeyPath) //nolint:gosec // path from t.TempDir()
	require.NoError(t, err)
	require.NoError(t, pem.Encode(f, encBlock))
	require.NoError(t, f.Close())

	c, err := NewClient(Options{
		ClientCertFile:   certPath,
		ClientKeyFile:    encKeyPath,
		ClientPassphrase: "mypassphrase",
	})
	require.NoError(t, err)
	transport := c.inner.Transport.(*http.Transport)
	require.Len(t, transport.TLSClientConfig.Certificates, 1)
}

func TestLoadClientCert_WrongPassphrase(t *testing.T) {
	dir := t.TempDir()
	certPath, keyPath := generateTestCert(t, dir)

	keyData, err := os.ReadFile(keyPath) //nolint:gosec // path from t.TempDir()
	require.NoError(t, err)
	block, _ := pem.Decode(keyData)
	require.NotNil(t, block)

	//nolint:staticcheck // x509.EncryptPEMBlock is deprecated but still the standard way to generate encrypted PEM for tests
	encBlock, err := x509.EncryptPEMBlock(rand.Reader, block.Type, block.Bytes, []byte("correct"), x509.PEMCipherAES256)
	require.NoError(t, err)
	encKeyPath := filepath.Join(dir, "enc.key")
	f, err := os.Create(encKeyPath) //nolint:gosec // path from t.TempDir()
	require.NoError(t, err)
	require.NoError(t, pem.Encode(f, encBlock))
	require.NoError(t, f.Close())

	_, err = NewClient(Options{
		ClientCertFile:   certPath,
		ClientKeyFile:    encKeyPath,
		ClientPassphrase: "wrong",
	})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "load client certificate")
}

func TestExecute_FormDataFileType(t *testing.T) {
	const fileContent = "hello file"
	b64 := base64.StdEncoding.EncodeToString([]byte(fileContent))

	var receivedFileName, receivedBody string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, header, err := r.FormFile("upload")
		require.NoError(t, err)
		receivedFileName = header.Filename
		f, _ := header.Open()
		data, _ := io.ReadAll(f)
		receivedBody = string(data)
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	c := newClient(t)
	req := &parser.Request{
		Method: "POST",
		URL:    parser.URL{Raw: srv.URL},
		Body: &parser.Body{
			Mode: parser.BodyModeFormData,
			FormData: []parser.FormDataParam{
				{Key: "upload", Value: b64, Src: "test.txt", Type: "file"},
			},
		},
	}
	resp, err := c.Execute(context.Background(), req, newVars(), nil)
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp.StatusCode)
	assert.Equal(t, "test.txt", receivedFileName)
	assert.Equal(t, fileContent, receivedBody)
}

// errorApplier always returns an error from Apply.
type errorApplier struct{}

func (errorApplier) Apply(_ context.Context, _ *http.Request, _ *variables.Resolver) error {
	return errors.New("forced auth error")
}
