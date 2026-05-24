// Package auth implements Postman authentication strategies.
package auth

import (
	"context"
	"fmt"
	nethttp "net/http"

	"github.com/guillaumedelre/reqlet/engine/parser"
	"github.com/guillaumedelre/reqlet/engine/variables"
)

// Applier adds authentication credentials to an outgoing HTTP request.
type Applier interface {
	Apply(ctx context.Context, req *nethttp.Request, vars *variables.Resolver) error
}

// TransportWrapper is optionally implemented by Appliers that need to intercept
// the HTTP response (e.g., Digest challenge-response handshake).
type TransportWrapper interface {
	WrapTransport(rt nethttp.RoundTripper) nethttp.RoundTripper
}

// New returns the Applier for the given auth config.
// Returns a NoAuth applier if a is nil.
func New(a *parser.Auth) (Applier, error) {
	if a == nil {
		return &noAuth{}, nil
	}
	switch a.Type {
	case parser.AuthTypeNoAuth, "":
		return &noAuth{}, nil
	case parser.AuthTypeBearer:
		return newBearer(a.Bearer)
	case parser.AuthTypeBasic:
		return newBasic(a.Basic)
	case parser.AuthTypeAPIKey:
		return newAPIKey(a.APIKey)
	case parser.AuthTypeDigest:
		return newDigest(a.Digest)
	case parser.AuthTypeOAuth2:
		return newOAuth2(a.OAuth2)
	case parser.AuthTypeAWSV4:
		return newAWSV4(a.AWSV4)
	default:
		return nil, fmt.Errorf("unsupported auth type: %q", a.Type)
	}
}

// Resolve returns the effective auth walking the inheritance chain:
// request auth > folder auths (innermost first) > collection auth.
// A nil auth on an item means "inherit from parent". Returns nil if
// no auth is defined anywhere in the chain.
func Resolve(reqAuth *parser.Auth, folderAuths []*parser.Auth, collectionAuth *parser.Auth) *parser.Auth {
	if reqAuth != nil {
		return reqAuth
	}
	for _, fa := range folderAuths {
		if fa != nil {
			return fa
		}
	}
	return collectionAuth
}

// paramStr extracts the string value of a named auth param.
// Returns "" if not found or if the value is not a string.
func paramStr(params []parser.AuthParam, key string) string {
	for _, p := range params {
		if p.Key == key {
			if s, ok := p.Value.(string); ok {
				return s
			}
		}
	}
	return ""
}
