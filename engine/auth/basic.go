package auth

import (
	"context"
	"fmt"
	nethttp "net/http"

	"github.com/guillaumedelre/reqlet/engine/parser"
	"github.com/guillaumedelre/reqlet/engine/variables"
)

type basic struct {
	username string
	password string
}

func newBasic(params []parser.AuthParam) (*basic, error) {
	username := paramStr(params, "username")
	if username == "" {
		return nil, fmt.Errorf("basic: missing username param")
	}
	return &basic{
		username: username,
		password: paramStr(params, "password"),
	}, nil
}

func (b *basic) Apply(_ context.Context, req *nethttp.Request, vars *variables.Resolver) error {
	req.SetBasicAuth(vars.Resolve(b.username), vars.Resolve(b.password))
	return nil
}
