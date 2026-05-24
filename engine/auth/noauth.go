package auth

import (
	"context"
	nethttp "net/http"

	"github.com/guillaumedelre/reqlet/engine/variables"
)

type noAuth struct{}

func (noAuth) Apply(_ context.Context, _ *nethttp.Request, _ *variables.Resolver) error {
	return nil
}
