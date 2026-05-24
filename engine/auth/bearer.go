package auth

import (
	"context"
	"fmt"
	nethttp "net/http"

	"github.com/guillaumedelre/reqlet/engine/parser"
	"github.com/guillaumedelre/reqlet/engine/variables"
)

type bearer struct {
	token string
}

func newBearer(params []parser.AuthParam) (*bearer, error) {
	token := paramStr(params, "token")
	if token == "" {
		return nil, fmt.Errorf("bearer: missing token param")
	}
	return &bearer{token: token}, nil
}

func (b *bearer) Apply(_ context.Context, req *nethttp.Request, vars *variables.Resolver) error {
	req.Header.Set("Authorization", "Bearer "+vars.Resolve(b.token))
	return nil
}
