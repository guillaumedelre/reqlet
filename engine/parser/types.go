// Package parser reads and validates Postman collection and environment files.
package parser

import (
	"encoding/json"
	"fmt"
)

// Collection is the root of a Postman Collection (v2.1).
type Collection struct {
	Info     Info       `json:"info"`
	Item     []Item     `json:"item"`
	Auth     *Auth      `json:"auth,omitempty"`
	Variable []Variable `json:"variable,omitempty"`
	Event    []Event    `json:"event,omitempty"`
}

// Info holds collection metadata.
type Info struct {
	PostmanID   string `json:"_postman_id,omitempty"`
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
	Schema      string `json:"schema"`
}

// Item is either a folder (Item != nil) or a request (Request != nil).
type Item struct {
	Name        string     `json:"name"`
	Item        []Item     `json:"item,omitempty"`
	Request     *Request   `json:"request,omitempty"`
	Response    []Response `json:"response,omitempty"`
	Event       []Event    `json:"event,omitempty"`
	Auth        *Auth      `json:"auth,omitempty"`
	Variable    []Variable `json:"variable,omitempty"`
	Description string     `json:"description,omitempty"`
}

// IsFolder reports whether the item is a folder.
func (i Item) IsFolder() bool { return i.Item != nil }

// Request describes an HTTP request.
type Request struct {
	Method      string   `json:"method"`
	URL         URL      `json:"url"`
	Header      []Header `json:"header,omitempty"`
	Body        *Body    `json:"body,omitempty"`
	Auth        *Auth    `json:"auth,omitempty"`
	Description string   `json:"description,omitempty"`
}

// URL holds a parsed Postman URL. In v2.1 it is always an object, but older
// exports may use a plain string — UnmarshalJSON handles both.
type URL struct {
	Raw      string       `json:"raw"`
	Protocol string       `json:"protocol,omitempty"`
	Host     []string     `json:"host,omitempty"`
	Path     []string     `json:"path,omitempty"`
	Query    []QueryParam `json:"query,omitempty"`
	Variable []Variable   `json:"variable,omitempty"`
}

// UnmarshalJSON handles both the string and object forms of URL.
func (u *URL) UnmarshalJSON(b []byte) error {
	// plain string form (old exports)
	var raw string
	if err := json.Unmarshal(b, &raw); err == nil {
		u.Raw = raw
		return nil
	}
	// object form — use an alias to avoid infinite recursion
	type urlAlias URL
	var alias urlAlias
	if err := json.Unmarshal(b, &alias); err != nil {
		return fmt.Errorf("url: %w", err)
	}
	*u = URL(alias)
	return nil
}

// QueryParam is a URL query parameter.
type QueryParam struct {
	Key      string `json:"key"`
	Value    string `json:"value"`
	Disabled bool   `json:"disabled,omitempty"`
}

// Header is an HTTP header.
type Header struct {
	Key      string `json:"key"`
	Value    string `json:"value"`
	Type     string `json:"type,omitempty"`
	Disabled bool   `json:"disabled,omitempty"`
}

// Body holds the request body for any of the supported modes.
type Body struct {
	Mode       BodyMode          `json:"mode"`
	Raw        string            `json:"raw,omitempty"`
	FormData   []FormDataParam   `json:"formdata,omitempty"`
	URLEncoded []URLEncodedParam `json:"urlencoded,omitempty"`
	GraphQL    *GraphQLBody      `json:"graphql,omitempty"`
	Options    *BodyOptions      `json:"options,omitempty"`
}

// BodyMode is the content type of the request body.
type BodyMode string

const (
	BodyModeRaw        BodyMode = "raw"
	BodyModeFormData   BodyMode = "formdata"
	BodyModeURLEncoded BodyMode = "urlencoded"
	BodyModeFile       BodyMode = "file"
	BodyModeGraphQL    BodyMode = "graphql"
)

// FormDataParam is a multipart/form-data field.
type FormDataParam struct {
	Key      string `json:"key"`
	Value    string `json:"value,omitempty"`
	Src      string `json:"src,omitempty"` // filename when Type == "file"
	Type     string `json:"type"`          // "text" or "file"
	Disabled bool   `json:"disabled,omitempty"`
}

// URLEncodedParam is an application/x-www-form-urlencoded field.
type URLEncodedParam struct {
	Key      string `json:"key"`
	Value    string `json:"value"`
	Disabled bool   `json:"disabled,omitempty"`
}

// GraphQLBody holds a GraphQL query and optional variables.
type GraphQLBody struct {
	Query     string `json:"query,omitempty"`
	Variables string `json:"variables,omitempty"`
}

// BodyOptions carries per-mode options (e.g. raw language).
type BodyOptions struct {
	Raw *RawOptions `json:"raw,omitempty"`
}

// RawOptions specifies the language of a raw body.
type RawOptions struct {
	Language string `json:"language,omitempty"` // "json", "xml", "text", "html", "javascript"
}

// Auth describes an authentication strategy.
type Auth struct {
	Type   AuthType    `json:"type"`
	Basic  []AuthParam `json:"basic,omitempty"`
	Bearer []AuthParam `json:"bearer,omitempty"`
	APIKey []AuthParam `json:"apikey,omitempty"`
	OAuth2 []AuthParam `json:"oauth2,omitempty"`
	Digest []AuthParam `json:"digest,omitempty"`
	AWSV4  []AuthParam `json:"awsv4,omitempty"`
	NTLM   []AuthParam `json:"ntlm,omitempty"`
	Hawk   []AuthParam `json:"hawk,omitempty"`
	OAuth1 []AuthParam `json:"oauth1,omitempty"`
}

// AuthType identifies the authentication mechanism.
type AuthType string

const (
	AuthTypeNoAuth AuthType = "noauth"
	AuthTypeBasic  AuthType = "basic"
	AuthTypeBearer AuthType = "bearer"
	AuthTypeAPIKey AuthType = "apikey"
	AuthTypeOAuth2 AuthType = "oauth2"
	AuthTypeDigest AuthType = "digest"
	AuthTypeAWSV4  AuthType = "awsv4"
	AuthTypeNTLM   AuthType = "ntlm"
	AuthTypeHawk   AuthType = "hawk"
	AuthTypeOAuth1 AuthType = "oauth1"
)

// AuthParam is a key-value pair inside an auth block.
// Value is interface{} because Postman uses strings, booleans, and numbers.
type AuthParam struct {
	Key   string      `json:"key"`
	Value interface{} `json:"value"`
	Type  string      `json:"type,omitempty"` // "string", "boolean", "any"
}

// Variable is a Postman variable (collection, environment, or URL path variable).
type Variable struct {
	Key         string `json:"key"`
	Value       string `json:"value,omitempty"`
	Type        string `json:"type,omitempty"`
	Description string `json:"description,omitempty"`
	Disabled    bool   `json:"disabled,omitempty"`
}

// Event is a lifecycle hook (pre-request or test script).
type Event struct {
	Listen string `json:"listen"` // "prerequest" or "test"
	Script Script `json:"script"`
}

// Script holds the executable JavaScript for an event.
type Script struct {
	Type string   `json:"type"` // "text/javascript"
	Exec []string `json:"exec"`
}

// Response is a saved example response attached to a request.
type Response struct {
	Name            string   `json:"name"`
	OriginalRequest *Request `json:"originalRequest,omitempty"`
	Status          string   `json:"status,omitempty"`
	Code            int      `json:"code,omitempty"`
	Header          []Header `json:"header,omitempty"`
	Body            string   `json:"body,omitempty"`
}

// Environment is a Postman environment file.
type Environment struct {
	ID     string             `json:"id"`
	Name   string             `json:"name"`
	Values []EnvironmentValue `json:"values"`
}

// EnvironmentValue is a single variable in an environment.
type EnvironmentValue struct {
	Key     string `json:"key"`
	Value   string `json:"value"`
	Enabled bool   `json:"enabled"`
	Type    string `json:"type,omitempty"` // "default" or "secret"
}
