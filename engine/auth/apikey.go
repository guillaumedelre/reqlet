package auth

import (
	"context"
	"fmt"
	nethttp "net/http"

	"github.com/guillaumedelre/reqlet/engine/parser"
	"github.com/guillaumedelre/reqlet/engine/variables"
)

type apiKey struct {
	key   string
	value string
	in    string // "header" (default) or "query"
}

func newAPIKey(params []parser.AuthParam) (*apiKey, error) {
	key := paramStr(params, "key")
	if key == "" {
		return nil, fmt.Errorf("apikey: missing key param")
	}
	in := paramStr(params, "in")
	if in == "" {
		in = "header"
	}
	return &apiKey{
		key:   key,
		value: paramStr(params, "value"),
		in:    in,
	}, nil
}

func (a *apiKey) Apply(_ context.Context, req *nethttp.Request, vars *variables.Resolver) error {
	k := vars.Resolve(a.key)
	v := vars.Resolve(a.value)
	switch a.in {
	case "query":
		q := req.URL.Query()
		q.Set(k, v)
		req.URL.RawQuery = q.Encode()
	default:
		req.Header.Set(k, v)
	}
	return nil
}
