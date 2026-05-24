// Package migration transforms parsed Postman collections (v1.0, v2.0) into
// the v2.1 internal model used by the engine.
package migration

import (
	"encoding/json"
	"fmt"

	"github.com/guillaumedelre/reqlet/engine/parser"
)

// V20ToV21 converts a v2.0 collection to the v2.1 internal model.
// The structural difference is auth params: v2.0 uses {"username": "foo"},
// v2.1 uses [{"key": "username", "value": "foo", "type": "string"}].
func V20ToV21(c *parser.CollectionV20) (*parser.Collection, error) {
	auth, err := convertAuthV20(c.Auth)
	if err != nil {
		return nil, fmt.Errorf("migrate collection auth: %w", err)
	}

	items, err := convertItemsV20(c.Item)
	if err != nil {
		return nil, err
	}

	return &parser.Collection{
		Info: parser.Info{
			PostmanID:   c.Info.PostmanID,
			Name:        c.Info.Name,
			Description: c.Info.Description,
			Schema:      parser.SchemaV21,
		},
		Item:     items,
		Auth:     auth,
		Variable: c.Variable,
		Event:    c.Event,
	}, nil
}

func convertItemsV20(items []parser.ItemV20) ([]parser.Item, error) {
	out := make([]parser.Item, len(items))
	for i, src := range items {
		auth, err := convertAuthV20(src.Auth)
		if err != nil {
			return nil, fmt.Errorf("item %q auth: %w", src.Name, err)
		}
		subitems, err := convertItemsV20(src.Item)
		if err != nil {
			return nil, err
		}
		req, err := convertRequestV20(src.Request)
		if err != nil {
			return nil, fmt.Errorf("item %q request: %w", src.Name, err)
		}
		out[i] = parser.Item{
			Name:        src.Name,
			Item:        subitems,
			Request:     req,
			Response:    src.Response,
			Event:       src.Event,
			Auth:        auth,
			Variable:    src.Variable,
			Description: src.Description,
		}
	}
	return out, nil
}

func convertRequestV20(r *parser.RequestV20) (*parser.Request, error) {
	if r == nil {
		return nil, nil
	}
	auth, err := convertAuthV20(r.Auth)
	if err != nil {
		return nil, fmt.Errorf("request auth: %w", err)
	}
	return &parser.Request{
		Method:      r.Method,
		URL:         r.URL,
		Header:      r.Header,
		Body:        r.Body,
		Auth:        auth,
		Description: r.Description,
	}, nil
}

// convertAuthV20 converts a v2.0 Auth to a v2.1 Auth.
func convertAuthV20(a *parser.AuthV20) (*parser.Auth, error) {
	if a == nil {
		return nil, nil
	}

	out := &parser.Auth{Type: a.Type}

	fields := []struct {
		raw  json.RawMessage
		dest *[]parser.AuthParam
		name string
	}{
		{a.Basic, &out.Basic, "basic"},
		{a.Bearer, &out.Bearer, "bearer"},
		{a.APIKey, &out.APIKey, "apikey"},
		{a.OAuth2, &out.OAuth2, "oauth2"},
		{a.Digest, &out.Digest, "digest"},
		{a.AWSV4, &out.AWSV4, "awsv4"},
		{a.NTLM, &out.NTLM, "ntlm"},
		{a.Hawk, &out.Hawk, "hawk"},
		{a.OAuth1, &out.OAuth1, "oauth1"},
	}
	for _, f := range fields {
		params, err := convertParams(f.raw)
		if err != nil {
			return nil, fmt.Errorf("%s: %w", f.name, err)
		}
		*f.dest = params
	}
	return out, nil
}

// convertParams converts auth params from either a JSON object or array form to []AuthParam.
// v2.0 uses {"username": "foo"} (object), v2.1 uses [{"key": "username", "value": "foo"}] (array).
// Both forms are accepted to handle mixed exports.
func convertParams(raw json.RawMessage) ([]parser.AuthParam, error) {
	if len(raw) == 0 {
		return nil, nil
	}

	// Try array form first (already in v2.1 format or mixed export).
	var arr []parser.AuthParam
	if err := json.Unmarshal(raw, &arr); err == nil {
		return arr, nil
	}

	// Fall back to object form (standard v2.0 format).
	var obj map[string]interface{}
	if err := json.Unmarshal(raw, &obj); err != nil {
		return nil, fmt.Errorf("auth params: expected object or array, got: %s", raw)
	}

	params := make([]parser.AuthParam, 0, len(obj))
	for k, v := range obj {
		params = append(params, parser.AuthParam{Key: k, Value: v, Type: "string"})
	}
	return params, nil
}
