package parser

import (
	"encoding/json"
	"fmt"
	"io"
	"strings"
)

// CollectionV20 represents a Postman Collection in v2.0 format.
// The only structural difference from v2.1 is the auth param encoding:
// v2.0 uses a plain object {"username": "foo"}, v2.1 uses a key-value array.
type CollectionV20 struct {
	Info     Info       `json:"info"`
	Item     []ItemV20  `json:"item"`
	Auth     *AuthV20   `json:"auth,omitempty"`
	Variable []Variable `json:"variable,omitempty"`
	Event    []Event    `json:"event,omitempty"`
}

// ItemV20 is an item (folder or request) in a v2.0 collection.
type ItemV20 struct {
	Name        string      `json:"name"`
	Item        []ItemV20   `json:"item,omitempty"`
	Request     *RequestV20 `json:"request,omitempty"`
	Response    []Response  `json:"response,omitempty"`
	Event       []Event     `json:"event,omitempty"`
	Auth        *AuthV20    `json:"auth,omitempty"`
	Variable    []Variable  `json:"variable,omitempty"`
	Description string      `json:"description,omitempty"`
}

// IsFolder reports whether the item is a folder.
func (i ItemV20) IsFolder() bool { return i.Item != nil }

// RequestV20 is an HTTP request in a v2.0 collection.
type RequestV20 struct {
	Method      string   `json:"method"`
	URL         URL      `json:"url"`
	Header      []Header `json:"header,omitempty"`
	Body        *Body    `json:"body,omitempty"`
	Auth        *AuthV20 `json:"auth,omitempty"`
	Description string   `json:"description,omitempty"`
}

// AuthV20 is an auth block in v2.0 format where parameters are stored as a
// plain JSON object ({"username": "foo"}) rather than a key-value array.
type AuthV20 struct {
	Type   AuthType        `json:"type"`
	Basic  json.RawMessage `json:"basic,omitempty"`
	Bearer json.RawMessage `json:"bearer,omitempty"`
	APIKey json.RawMessage `json:"apikey,omitempty"`
	OAuth2 json.RawMessage `json:"oauth2,omitempty"`
	Digest json.RawMessage `json:"digest,omitempty"`
	AWSV4  json.RawMessage `json:"awsv4,omitempty"`
	NTLM   json.RawMessage `json:"ntlm,omitempty"`
	Hawk   json.RawMessage `json:"hawk,omitempty"`
	OAuth1 json.RawMessage `json:"oauth1,omitempty"`
}

// ParseCollectionV20 reads a Postman Collection v2.0 from r.
func ParseCollectionV20(r io.Reader) (*CollectionV20, error) {
	data, err := io.ReadAll(r)
	if err != nil {
		return nil, fmt.Errorf("read collection: %w", err)
	}

	var c CollectionV20
	if err := json.Unmarshal(data, &c); err != nil {
		return nil, fmt.Errorf("parse collection v2.0: %w", err)
	}

	if c.Info.Name == "" {
		return nil, fmt.Errorf("collection: missing info.name")
	}
	if !strings.HasPrefix(c.Info.Schema, SchemaV20) {
		return nil, fmt.Errorf("collection: expected v2.0 schema, got %q", c.Info.Schema)
	}

	if err := validateAgainstSchema(data, compiledV20); err != nil {
		return nil, err
	}

	return &c, nil
}
