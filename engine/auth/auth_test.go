package auth

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/guillaumedelre/reqlet/engine/parser"
	"github.com/guillaumedelre/reqlet/engine/variables"
)

// ── helpers ───────────────────────────────────────────────────────────────────

func newReq(t *testing.T, method, url string) *http.Request {
	t.Helper()
	req, err := http.NewRequestWithContext(context.Background(), method, url, nil)
	require.NoError(t, err)
	return req
}

func newVars(kvs ...string) *variables.Resolver {
	r := variables.NewResolver()
	for i := 0; i+1 < len(kvs); i += 2 {
		r.Set(variables.ScopeEnvironment, kvs[i], kvs[i+1])
	}
	return r
}

func authParam(key string, value interface{}) parser.AuthParam {
	return parser.AuthParam{Key: key, Value: value}
}

// ── New / factory ─────────────────────────────────────────────────────────────

func TestNew_Nil(t *testing.T) {
	a, err := New(nil)
	require.NoError(t, err)
	assert.IsType(t, &noAuth{}, a)
}

func TestNew_NoAuth(t *testing.T) {
	a, err := New(&parser.Auth{Type: parser.AuthTypeNoAuth})
	require.NoError(t, err)
	assert.IsType(t, &noAuth{}, a)
}

func TestNew_Unsupported(t *testing.T) {
	_, err := New(&parser.Auth{Type: "hawk"})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "unsupported auth type")
}

// ── Resolve (inheritance) ─────────────────────────────────────────────────────

func TestResolve_RequestWins(t *testing.T) {
	req := &parser.Auth{Type: parser.AuthTypeBearer}
	folder := &parser.Auth{Type: parser.AuthTypeBasic}
	col := &parser.Auth{Type: parser.AuthTypeAPIKey}

	got := Resolve(req, []*parser.Auth{folder}, col)
	assert.Equal(t, req, got)
}

func TestResolve_FolderWhenRequestNil(t *testing.T) {
	folder := &parser.Auth{Type: parser.AuthTypeBasic}
	col := &parser.Auth{Type: parser.AuthTypeAPIKey}

	got := Resolve(nil, []*parser.Auth{folder}, col)
	assert.Equal(t, folder, got)
}

func TestResolve_CollectionFallback(t *testing.T) {
	col := &parser.Auth{Type: parser.AuthTypeAPIKey}

	got := Resolve(nil, []*parser.Auth{nil}, col)
	assert.Equal(t, col, got)
}

func TestResolve_AllNil(t *testing.T) {
	got := Resolve(nil, []*parser.Auth{nil}, nil)
	assert.Nil(t, got)
}

func TestResolve_InnermostFolderWins(t *testing.T) {
	inner := &parser.Auth{Type: parser.AuthTypeBearer}
	outer := &parser.Auth{Type: parser.AuthTypeBasic}

	got := Resolve(nil, []*parser.Auth{inner, outer}, nil)
	assert.Equal(t, inner, got)
}

// ── NoAuth ────────────────────────────────────────────────────────────────────

func TestNoAuth_Apply(t *testing.T) {
	req := newReq(t, "GET", "http://example.com")
	err := (&noAuth{}).Apply(context.Background(), req, newVars())
	require.NoError(t, err)
	assert.Empty(t, req.Header.Get("Authorization"))
}

// ── Bearer ────────────────────────────────────────────────────────────────────

func TestBearer_Apply(t *testing.T) {
	a, err := New(&parser.Auth{
		Type:   parser.AuthTypeBearer,
		Bearer: []parser.AuthParam{authParam("token", "my-secret")},
	})
	require.NoError(t, err)

	req := newReq(t, "GET", "http://example.com")
	require.NoError(t, a.Apply(context.Background(), req, newVars()))
	assert.Equal(t, "Bearer my-secret", req.Header.Get("Authorization"))
}

func TestBearer_VariableResolved(t *testing.T) {
	a, err := New(&parser.Auth{
		Type:   parser.AuthTypeBearer,
		Bearer: []parser.AuthParam{authParam("token", "{{tok}}")},
	})
	require.NoError(t, err)

	req := newReq(t, "GET", "http://example.com")
	require.NoError(t, a.Apply(context.Background(), req, newVars("tok", "resolved-token")))
	assert.Equal(t, "Bearer resolved-token", req.Header.Get("Authorization"))
}

func TestBearer_MissingToken(t *testing.T) {
	_, err := New(&parser.Auth{Type: parser.AuthTypeBearer, Bearer: nil})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "missing token")
}

// ── Basic ─────────────────────────────────────────────────────────────────────

func TestBasic_Apply(t *testing.T) {
	a, err := New(&parser.Auth{
		Type: parser.AuthTypeBasic,
		Basic: []parser.AuthParam{
			authParam("username", "alice"),
			authParam("password", "s3cr3t"),
		},
	})
	require.NoError(t, err)

	req := newReq(t, "GET", "http://example.com")
	require.NoError(t, a.Apply(context.Background(), req, newVars()))
	user, pass, ok := req.BasicAuth()
	require.True(t, ok)
	assert.Equal(t, "alice", user)
	assert.Equal(t, "s3cr3t", pass)
}

func TestBasic_VariableResolved(t *testing.T) {
	a, err := New(&parser.Auth{
		Type: parser.AuthTypeBasic,
		Basic: []parser.AuthParam{
			authParam("username", "{{user}}"),
			authParam("password", "{{pass}}"),
		},
	})
	require.NoError(t, err)

	req := newReq(t, "GET", "http://example.com")
	require.NoError(t, a.Apply(context.Background(), req, newVars("user", "bob", "pass", "pwd")))
	user, pass, ok := req.BasicAuth()
	require.True(t, ok)
	assert.Equal(t, "bob", user)
	assert.Equal(t, "pwd", pass)
}

func TestBasic_MissingUsername(t *testing.T) {
	_, err := New(&parser.Auth{Type: parser.AuthTypeBasic, Basic: nil})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "missing username")
}

// ── API Key ───────────────────────────────────────────────────────────────────

func TestAPIKey_Header(t *testing.T) {
	a, err := New(&parser.Auth{
		Type: parser.AuthTypeAPIKey,
		APIKey: []parser.AuthParam{
			authParam("key", "X-API-Key"),
			authParam("value", "abc123"),
			authParam("in", "header"),
		},
	})
	require.NoError(t, err)

	req := newReq(t, "GET", "http://example.com")
	require.NoError(t, a.Apply(context.Background(), req, newVars()))
	assert.Equal(t, "abc123", req.Header.Get("X-API-Key"))
}

func TestAPIKey_Query(t *testing.T) {
	a, err := New(&parser.Auth{
		Type: parser.AuthTypeAPIKey,
		APIKey: []parser.AuthParam{
			authParam("key", "api_key"),
			authParam("value", "tok"),
			authParam("in", "query"),
		},
	})
	require.NoError(t, err)

	req := newReq(t, "GET", "http://example.com/path")
	require.NoError(t, a.Apply(context.Background(), req, newVars()))
	assert.Equal(t, "tok", req.URL.Query().Get("api_key"))
}

func TestAPIKey_DefaultsToHeader(t *testing.T) {
	a, err := New(&parser.Auth{
		Type: parser.AuthTypeAPIKey,
		APIKey: []parser.AuthParam{
			authParam("key", "X-Token"),
			authParam("value", "val"),
		},
	})
	require.NoError(t, err)

	req := newReq(t, "GET", "http://example.com")
	require.NoError(t, a.Apply(context.Background(), req, newVars()))
	assert.Equal(t, "val", req.Header.Get("X-Token"))
}

func TestAPIKey_MissingKey(t *testing.T) {
	_, err := New(&parser.Auth{Type: parser.AuthTypeAPIKey, APIKey: nil})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "missing key")
}

// ── Digest ────────────────────────────────────────────────────────────────────

func TestDigest_ChallengeResponse(t *testing.T) {
	const (
		testUser  = "alice"
		testPass  = "secret"
		testRealm = "testrealm"
		testNonce = "dcd98b7102dd2f0e8b11d0f600bfb0c093"
	)

	challenged := false
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") == "" {
			challenged = true
			w.Header().Set("WWW-Authenticate",
				`Digest realm="`+testRealm+`", nonce="`+testNonce+`"`)
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		authHdr := r.Header.Get("Authorization")
		assert.Contains(t, authHdr, `username="alice"`)
		assert.Contains(t, authHdr, `realm="testrealm"`)
		assert.Contains(t, authHdr, `response=`)
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	a, err := New(&parser.Auth{
		Type: parser.AuthTypeDigest,
		Digest: []parser.AuthParam{
			authParam("username", testUser),
			authParam("password", testPass),
		},
	})
	require.NoError(t, err)

	// Wire the transport wrapper.
	transport := http.DefaultTransport
	if tw, ok := a.(TransportWrapper); ok {
		transport = tw.WrapTransport(transport)
	}
	client := &http.Client{Transport: transport}

	req, err := http.NewRequestWithContext(context.Background(), "GET", srv.URL, nil)
	require.NoError(t, err)
	require.NoError(t, a.Apply(context.Background(), req, newVars()))

	resp, err := client.Do(req)
	require.NoError(t, err)
	defer func() { _ = resp.Body.Close() }()

	assert.True(t, challenged, "server should have issued a challenge")
	assert.Equal(t, http.StatusOK, resp.StatusCode)
}

func TestDigest_MissingUsername(t *testing.T) {
	_, err := New(&parser.Auth{Type: parser.AuthTypeDigest, Digest: nil})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "missing username")
}

func TestDigest_ParseChallenge(t *testing.T) {
	params := parseDigestChallenge(`realm="testrealm@host.com", qop="auth", nonce="abc123"`)
	assert.Equal(t, "testrealm@host.com", params["realm"])
	assert.Equal(t, "auth", params["qop"])
	assert.Equal(t, "abc123", params["nonce"])
}

// ── OAuth2 Client Credentials ─────────────────────────────────────────────────

func TestOAuth2_ClientCredentials(t *testing.T) {
	tokenSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.NoError(t, r.ParseForm())
		assert.Equal(t, "client_credentials", r.FormValue("grant_type"))
		assert.Equal(t, "my-client", r.FormValue("client_id"))
		assert.Equal(t, "my-secret", r.FormValue("client_secret"))

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{"access_token": "fetched-token"})
	}))
	defer tokenSrv.Close()

	a, err := New(&parser.Auth{
		Type: parser.AuthTypeOAuth2,
		OAuth2: []parser.AuthParam{
			authParam("accessTokenUrl", tokenSrv.URL),
			authParam("clientId", "my-client"),
			authParam("clientSecret", "my-secret"),
			authParam("grantType", "client_credentials"),
		},
	})
	require.NoError(t, err)

	req := newReq(t, "GET", "http://api.example.com")
	require.NoError(t, a.Apply(context.Background(), req, newVars()))
	assert.Equal(t, "Bearer fetched-token", req.Header.Get("Authorization"))
}

func TestOAuth2_WithScope(t *testing.T) {
	tokenSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.NoError(t, r.ParseForm())
		assert.Equal(t, "read write", r.FormValue("scope"))
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{"access_token": "scoped-token"})
	}))
	defer tokenSrv.Close()

	a, err := New(&parser.Auth{
		Type: parser.AuthTypeOAuth2,
		OAuth2: []parser.AuthParam{
			authParam("accessTokenUrl", tokenSrv.URL),
			authParam("clientId", "id"),
			authParam("clientSecret", "secret"),
			authParam("scope", "read write"),
		},
	})
	require.NoError(t, err)

	req := newReq(t, "GET", "http://api.example.com")
	require.NoError(t, a.Apply(context.Background(), req, newVars()))
	assert.Equal(t, "Bearer scoped-token", req.Header.Get("Authorization"))
}

func TestOAuth2_TokenEndpointError(t *testing.T) {
	tokenSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = w.Write([]byte(`{"error":"invalid_client"}`))
	}))
	defer tokenSrv.Close()

	a, err := New(&parser.Auth{
		Type: parser.AuthTypeOAuth2,
		OAuth2: []parser.AuthParam{
			authParam("accessTokenUrl", tokenSrv.URL),
			authParam("clientId", "bad"),
			authParam("clientSecret", "bad"),
		},
	})
	require.NoError(t, err)

	req := newReq(t, "GET", "http://api.example.com")
	err = a.Apply(context.Background(), req, newVars())
	require.Error(t, err)
	assert.Contains(t, err.Error(), "401")
}

func TestOAuth2_MissingTokenURL(t *testing.T) {
	_, err := New(&parser.Auth{Type: parser.AuthTypeOAuth2, OAuth2: nil})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "missing accessTokenUrl")
}

func TestOAuth2_MissingClientID(t *testing.T) {
	_, err := New(&parser.Auth{
		Type:   parser.AuthTypeOAuth2,
		OAuth2: []parser.AuthParam{authParam("accessTokenUrl", "http://example.com")},
	})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "missing clientId")
}

// ── AWS Signature v4 ──────────────────────────────────────────────────────────

func TestAWSV4_SetsAuthorizationHeader(t *testing.T) {
	a, err := New(&parser.Auth{
		Type: parser.AuthTypeAWSV4,
		AWSV4: []parser.AuthParam{
			authParam("accessKey", "AKIAIOSFODNN7EXAMPLE"),
			authParam("secretKey", "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"),
			authParam("region", "us-east-1"),
			authParam("service", "s3"),
		},
	})
	require.NoError(t, err)

	req := newReq(t, "GET", "https://s3.amazonaws.com/my-bucket/my-object")
	require.NoError(t, a.Apply(context.Background(), req, newVars()))

	authHdr := req.Header.Get("Authorization")
	assert.Contains(t, authHdr, "AWS4-HMAC-SHA256")
	assert.Contains(t, authHdr, "AKIAIOSFODNN7EXAMPLE")
	assert.Contains(t, authHdr, "Credential=")
	assert.Contains(t, authHdr, "SignedHeaders=")
	assert.Contains(t, authHdr, "Signature=")
	assert.NotEmpty(t, req.Header.Get("x-amz-date"))
}

func TestAWSV4_WithSessionToken(t *testing.T) {
	a, err := New(&parser.Auth{
		Type: parser.AuthTypeAWSV4,
		AWSV4: []parser.AuthParam{
			authParam("accessKey", "AKID"),
			authParam("secretKey", "SECRET"),
			authParam("region", "eu-west-1"),
			authParam("service", "execute-api"),
			authParam("sessionToken", "TOKEN"),
		},
	})
	require.NoError(t, err)

	req := newReq(t, "POST", "https://api.example.com/v1/resource")
	req.Body = io.NopCloser(strings.NewReader(`{"key":"value"}`))
	req.GetBody = func() (io.ReadCloser, error) {
		return io.NopCloser(strings.NewReader(`{"key":"value"}`)), nil
	}
	require.NoError(t, a.Apply(context.Background(), req, newVars()))

	assert.Equal(t, "TOKEN", req.Header.Get("x-amz-security-token"))
}

func TestAWSV4_VariableResolved(t *testing.T) {
	a, err := New(&parser.Auth{
		Type: parser.AuthTypeAWSV4,
		AWSV4: []parser.AuthParam{
			authParam("accessKey", "{{aws_key}}"),
			authParam("secretKey", "{{aws_secret}}"),
			authParam("region", "us-west-2"),
			authParam("service", "iam"),
		},
	})
	require.NoError(t, err)

	req := newReq(t, "GET", "https://iam.amazonaws.com/")
	vars := newVars("aws_key", "RESOLVEDKEY", "aws_secret", "RESOLVEDSECRET")
	require.NoError(t, a.Apply(context.Background(), req, vars))

	assert.Contains(t, req.Header.Get("Authorization"), "RESOLVEDKEY")
}

func TestAWSV4_MissingParams(t *testing.T) {
	cases := []struct {
		name   string
		params []parser.AuthParam
		errMsg string
	}{
		{"no accessKey", nil, "missing accessKey"},
		{"no secretKey", []parser.AuthParam{authParam("accessKey", "k")}, "missing secretKey"},
		{"no region", []parser.AuthParam{
			authParam("accessKey", "k"), authParam("secretKey", "s"),
		}, "missing region"},
		{"no service", []parser.AuthParam{
			authParam("accessKey", "k"), authParam("secretKey", "s"), authParam("region", "r"),
		}, "missing service"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := New(&parser.Auth{Type: parser.AuthTypeAWSV4, AWSV4: tc.params})
			require.Error(t, err)
			assert.Contains(t, err.Error(), tc.errMsg)
		})
	}
}

func TestAWSV4_EmptyPath(t *testing.T) {
	a, err := newAWSV4([]parser.AuthParam{
		authParam("accessKey", "AKID"),
		authParam("secretKey", "SECRET"),
		authParam("region", "us-east-1"),
		authParam("service", "s3"),
	})
	require.NoError(t, err)

	// URL with no path triggers the awsCanonicalURI("") == "/" branch.
	req := newReq(t, "GET", "https://s3.amazonaws.com")
	req.URL.Path = ""
	require.NoError(t, a.Apply(context.Background(), req, newVars()))
	assert.Contains(t, req.Header.Get("Authorization"), "AWS4-HMAC-SHA256")
}

func TestAWSV4_WithQueryParams(t *testing.T) {
	a, err := newAWSV4([]parser.AuthParam{
		authParam("accessKey", "AKID"),
		authParam("secretKey", "SECRET"),
		authParam("region", "us-east-1"),
		authParam("service", "s3"),
	})
	require.NoError(t, err)

	req := newReq(t, "GET", "https://s3.amazonaws.com/bucket?prefix=foo&delimiter=%2F")
	require.NoError(t, a.Apply(context.Background(), req, newVars()))
	assert.Contains(t, req.Header.Get("Authorization"), "AWS4-HMAC-SHA256")
}

func TestAWSV4_BodyWithoutGetBody(t *testing.T) {
	a, err := newAWSV4([]parser.AuthParam{
		authParam("accessKey", "AKID"),
		authParam("secretKey", "SECRET"),
		authParam("region", "us-east-1"),
		authParam("service", "execute-api"),
	})
	require.NoError(t, err)

	// Body set but GetBody nil: awsBodyHash falls back to empty hash.
	req := newReq(t, "POST", "https://api.example.com/resource")
	req.Body = io.NopCloser(strings.NewReader(`{"data":1}`))
	// GetBody intentionally left nil.
	require.NoError(t, a.Apply(context.Background(), req, newVars()))
	assert.Contains(t, req.Header.Get("Authorization"), "AWS4-HMAC-SHA256")
}

func TestAWSV4_ExplicitReqHost(t *testing.T) {
	a, err := newAWSV4([]parser.AuthParam{
		authParam("accessKey", "AKID"),
		authParam("secretKey", "SECRET"),
		authParam("region", "us-east-1"),
		authParam("service", "s3"),
	})
	require.NoError(t, err)

	req := newReq(t, "GET", "https://s3.amazonaws.com/bucket/key")
	req.Host = "s3.amazonaws.com" // explicit Host field, not from URL.
	require.NoError(t, a.Apply(context.Background(), req, newVars()))
	assert.Contains(t, req.Header.Get("Authorization"), "AWS4-HMAC-SHA256")
}

// ── Digest — additional branches ─────────────────────────────────────────────

func TestDigest_TransportError(t *testing.T) {
	errTransport := roundTripFunc(func(*http.Request) (*http.Response, error) {
		return nil, fmt.Errorf("connection refused")
	})
	dt := &digestTransport{inner: errTransport, username: "u", password: "p"}
	req := newReq(t, "GET", "http://example.com")
	_, err := dt.RoundTrip(req)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "connection refused")
}

func TestDigest_NonDigestWWWAuthenticate(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("WWW-Authenticate", "Basic realm=\"test\"")
		w.WriteHeader(http.StatusUnauthorized)
	}))
	defer srv.Close()

	dt := &digestTransport{inner: http.DefaultTransport, username: "u", password: "p"}
	req := newReq(t, "GET", srv.URL)
	resp, err := dt.RoundTrip(req)
	require.NoError(t, err)
	defer func() { _ = resp.Body.Close() }()
	assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
}

func TestDigest_WithQop(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") == "" {
			w.Header().Set("WWW-Authenticate",
				`Digest realm="testrealm", nonce="abc", qop="auth"`)
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		authHdr := r.Header.Get("Authorization")
		assert.Contains(t, authHdr, "qop=auth")
		assert.Contains(t, authHdr, "nc=")
		assert.Contains(t, authHdr, "cnonce=")
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	dt := &digestTransport{inner: http.DefaultTransport, username: "alice", password: "secret"}
	req := newReq(t, "GET", srv.URL)
	resp, err := dt.RoundTrip(req)
	require.NoError(t, err)
	defer func() { _ = resp.Body.Close() }()
	assert.Equal(t, http.StatusOK, resp.StatusCode)
}

func TestDigest_MD5Sess(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") == "" {
			w.Header().Set("WWW-Authenticate",
				`Digest realm="testrealm", nonce="abc", algorithm=MD5-sess`)
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		assert.Contains(t, r.Header.Get("Authorization"), "algorithm=MD5-sess")
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	dt := &digestTransport{inner: http.DefaultTransport, username: "alice", password: "secret"}
	req := newReq(t, "GET", srv.URL)
	resp, err := dt.RoundTrip(req)
	require.NoError(t, err)
	defer func() { _ = resp.Body.Close() }()
	assert.Equal(t, http.StatusOK, resp.StatusCode)
}

func TestDigest_BodyReplay(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") == "" {
			w.Header().Set("WWW-Authenticate",
				`Digest realm="testrealm", nonce="abc"`)
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		body, _ := io.ReadAll(r.Body)
		assert.Equal(t, `{"key":"value"}`, string(body))
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	dt := &digestTransport{inner: http.DefaultTransport, username: "alice", password: "secret"}
	req, err := http.NewRequestWithContext(context.Background(), "POST", srv.URL,
		strings.NewReader(`{"key":"value"}`))
	require.NoError(t, err)
	// GetBody must be set for the body to be replayed.
	req.GetBody = func() (io.ReadCloser, error) {
		return io.NopCloser(strings.NewReader(`{"key":"value"}`)), nil
	}

	resp, err := dt.RoundTrip(req)
	require.NoError(t, err)
	defer func() { _ = resp.Body.Close() }()
	assert.Equal(t, http.StatusOK, resp.StatusCode)
}

// ── OAuth2 — additional branches ──────────────────────────────────────────────

func TestOAuth2_EmptyAccessToken(t *testing.T) {
	tokenSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"access_token":""}`))
	}))
	defer tokenSrv.Close()

	a, err := New(&parser.Auth{
		Type: parser.AuthTypeOAuth2,
		OAuth2: []parser.AuthParam{
			authParam("accessTokenUrl", tokenSrv.URL),
			authParam("clientId", "id"),
			authParam("clientSecret", "secret"),
		},
	})
	require.NoError(t, err)

	req := newReq(t, "GET", "http://api.example.com")
	err = a.Apply(context.Background(), req, newVars())
	require.Error(t, err)
	assert.Contains(t, err.Error(), "empty access_token")
}

func TestOAuth2_InvalidJSON(t *testing.T) {
	tokenSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`not-json`))
	}))
	defer tokenSrv.Close()

	a, err := New(&parser.Auth{
		Type: parser.AuthTypeOAuth2,
		OAuth2: []parser.AuthParam{
			authParam("accessTokenUrl", tokenSrv.URL),
			authParam("clientId", "id"),
			authParam("clientSecret", "secret"),
		},
	})
	require.NoError(t, err)

	req := newReq(t, "GET", "http://api.example.com")
	err = a.Apply(context.Background(), req, newVars())
	require.Error(t, err)
	assert.Contains(t, err.Error(), "decode token response")
}

// roundTripFunc is a test helper that adapts a function to http.RoundTripper.
type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }
