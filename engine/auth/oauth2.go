package auth

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	nethttp "net/http"
	"net/url"
	"strings"

	"github.com/guillaumedelre/reqlet/engine/parser"
	"github.com/guillaumedelre/reqlet/engine/variables"
)

type oauth2 struct {
	tokenURL     string
	clientID     string
	clientSecret string
	scope        string
}

func newOAuth2(params []parser.AuthParam) (*oauth2, error) {
	tokenURL := paramStr(params, "accessTokenUrl")
	if tokenURL == "" {
		return nil, fmt.Errorf("oauth2: missing accessTokenUrl param")
	}
	clientID := paramStr(params, "clientId")
	if clientID == "" {
		return nil, fmt.Errorf("oauth2: missing clientId param")
	}
	return &oauth2{
		tokenURL:     tokenURL,
		clientID:     clientID,
		clientSecret: paramStr(params, "clientSecret"),
		scope:        paramStr(params, "scope"),
	}, nil
}

func (o *oauth2) Apply(ctx context.Context, req *nethttp.Request, vars *variables.Resolver) error {
	token, err := o.fetchToken(ctx, vars)
	if err != nil {
		return fmt.Errorf("oauth2: fetch token: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+token)
	return nil
}

func (o *oauth2) fetchToken(ctx context.Context, vars *variables.Resolver) (string, error) {
	form := url.Values{
		"grant_type":    {"client_credentials"},
		"client_id":     {vars.Resolve(o.clientID)},
		"client_secret": {vars.Resolve(o.clientSecret)},
	}
	if o.scope != "" {
		form.Set("scope", vars.Resolve(o.scope))
	}

	tokenURL := vars.Resolve(o.tokenURL)
	httpReq, err := nethttp.NewRequestWithContext(ctx, nethttp.MethodPost, tokenURL,
		strings.NewReader(form.Encode()))
	if err != nil {
		return "", err
	}
	httpReq.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := nethttp.DefaultClient.Do(httpReq)
	if err != nil {
		return "", err
	}
	defer func() { _ = resp.Body.Close() }()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("read token response: %w", err)
	}
	if resp.StatusCode != nethttp.StatusOK {
		return "", fmt.Errorf("token endpoint returned %d: %s", resp.StatusCode, body)
	}

	var payload struct {
		AccessToken string `json:"access_token"`
	}
	if err := json.Unmarshal(body, &payload); err != nil {
		return "", fmt.Errorf("decode token response: %w", err)
	}
	if payload.AccessToken == "" {
		return "", fmt.Errorf("token endpoint returned empty access_token")
	}
	return payload.AccessToken, nil
}
