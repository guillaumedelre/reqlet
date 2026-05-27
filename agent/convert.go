package main

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strings"

	"github.com/google/uuid"

	"github.com/guillaumedelre/reqlet/engine/parser"
)

// --- frontend sub-types ---

type feKV struct {
	ID          string `json:"id"`
	Key         string `json:"key"`
	Value       string `json:"value"`
	Description string `json:"description"`
	Enabled     bool   `json:"enabled"`
}

type feVariable struct {
	ID           string `json:"id"`
	Key          string `json:"key"`
	InitialValue string `json:"initialValue"`
	CurrentValue string `json:"currentValue"`
	Enabled      bool   `json:"enabled"`
}

type feFormDataItem struct {
	ID          string `json:"id"`
	Key         string `json:"key"`
	ValueType   string `json:"valueType"`
	Value       string `json:"value"`
	FileName    string `json:"fileName"`
	FileContent string `json:"fileContent"`
	Description string `json:"description"`
	Enabled     bool   `json:"enabled"`
}

type feBody struct {
	Type           string           `json:"type"`
	Raw            string           `json:"raw"`
	RawContentType string           `json:"rawContentType"`
	FormData       []feFormDataItem `json:"formData"`
	URLEncoded     []feKV           `json:"urlencoded"`
	GraphQLQuery   string           `json:"graphqlQuery"`
	GraphQLVars    string           `json:"graphqlVariables"`
}

type feAuthBearer struct {
	Token string `json:"token"`
}

type feAuthBasic struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type feAuthAPIKey struct {
	Key   string `json:"key"`
	Value string `json:"value"`
	AddTo string `json:"addTo"`
}

type feAuthDigest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type feAuthOAuth1 struct {
	ConsumerKey     string `json:"consumerKey"`
	ConsumerSecret  string `json:"consumerSecret"`
	Token           string `json:"token"`
	TokenSecret     string `json:"tokenSecret"`
	SignatureMethod string `json:"signatureMethod"`
}

type feAuthOAuth2 struct {
	GrantType   string `json:"grantType"`
	AccessToken string `json:"accessToken"`
	TokenType   string `json:"tokenType"`
	AddTokenTo  string `json:"addTokenTo"`
}

type feAuthHawk struct {
	AuthID    string `json:"authId"`
	AuthKey   string `json:"authKey"`
	Algorithm string `json:"algorithm"`
}

type feAuthAWSSignature struct {
	AccessKey    string `json:"accessKey"`
	SecretKey    string `json:"secretKey"`
	Region       string `json:"region"`
	Service      string `json:"service"`
	SessionToken string `json:"sessionToken"`
}

type feAuthNTLM struct {
	Username    string `json:"username"`
	Password    string `json:"password"`
	Domain      string `json:"domain"`
	Workstation string `json:"workstation"`
}

type feAuth struct {
	Type         string              `json:"type"`
	Bearer       *feAuthBearer       `json:"bearer,omitempty"`
	Basic        *feAuthBasic        `json:"basic,omitempty"`
	APIKey       *feAuthAPIKey       `json:"apiKey,omitempty"`
	Digest       *feAuthDigest       `json:"digest,omitempty"`
	OAuth1       *feAuthOAuth1       `json:"oauth1,omitempty"`
	OAuth2       *feAuthOAuth2       `json:"oauth2,omitempty"`
	Hawk         *feAuthHawk         `json:"hawk,omitempty"`
	AWSSignature *feAuthAWSSignature `json:"awsSignature,omitempty"`
	NTLM         *feAuthNTLM         `json:"ntlm,omitempty"`
}

// --- utilities ---

func newID() string {
	return uuid.New().String()
}

func orID(s string) string {
	if s != "" {
		return s
	}
	return newID()
}

func authParamStr(params []parser.AuthParam, key string) string {
	for _, p := range params {
		if p.Key == key {
			if s, ok := p.Value.(string); ok {
				return s
			}
			return fmt.Sprintf("%v", p.Value)
		}
	}
	return ""
}

func extractScript(events []parser.Event, listen string) string {
	for _, e := range events {
		if e.Listen == listen {
			return strings.Join(e.Script.Exec, "\n")
		}
	}
	return ""
}

func buildEvents(pre, test string) []parser.Event {
	var events []parser.Event
	if pre != "" {
		events = append(events, parser.Event{
			Listen: "prerequest",
			Script: parser.Script{Type: "text/javascript", Exec: strings.Split(pre, "\n")},
		})
	}
	if test != "" {
		events = append(events, parser.Event{
			Listen: "test",
			Script: parser.Script{Type: "text/javascript", Exec: strings.Split(test, "\n")},
		})
	}
	return events
}

var sanitizeRe = regexp.MustCompile(`[^\w\-. ]+`)

func sanitizeFilename(s string) string {
	return sanitizeRe.ReplaceAllString(s, "_")
}

// --- auth conversion ---

func convertAuthToFrontend(a *parser.Auth, isRoot bool) feAuth {
	if a == nil {
		if isRoot {
			return feAuth{Type: "none"}
		}
		return feAuth{Type: "inherit"}
	}
	fa := feAuth{}
	switch a.Type {
	case parser.AuthTypeNoAuth:
		fa.Type = "none"
	case parser.AuthTypeBearer:
		fa.Type = "bearer"
		fa.Bearer = &feAuthBearer{Token: authParamStr(a.Bearer, "token")}
	case parser.AuthTypeBasic:
		fa.Type = "basic"
		fa.Basic = &feAuthBasic{
			Username: authParamStr(a.Basic, "username"),
			Password: authParamStr(a.Basic, "password"),
		}
	case parser.AuthTypeAPIKey:
		fa.Type = "api-key"
		fa.APIKey = &feAuthAPIKey{
			Key:   authParamStr(a.APIKey, "key"),
			Value: authParamStr(a.APIKey, "value"),
			AddTo: authParamStr(a.APIKey, "in"),
		}
	case parser.AuthTypeDigest:
		fa.Type = "digest"
		fa.Digest = &feAuthDigest{
			Username: authParamStr(a.Digest, "username"),
			Password: authParamStr(a.Digest, "password"),
		}
	case parser.AuthTypeOAuth1:
		fa.Type = "oauth1"
		fa.OAuth1 = &feAuthOAuth1{
			ConsumerKey:     authParamStr(a.OAuth1, "consumerKey"),
			ConsumerSecret:  authParamStr(a.OAuth1, "consumerSecret"),
			Token:           authParamStr(a.OAuth1, "token"),
			TokenSecret:     authParamStr(a.OAuth1, "tokenSecret"),
			SignatureMethod: authParamStr(a.OAuth1, "signatureMethod"),
		}
	case parser.AuthTypeOAuth2:
		fa.Type = "oauth2"
		fa.OAuth2 = &feAuthOAuth2{
			GrantType:   authParamStr(a.OAuth2, "grant_type"),
			AccessToken: authParamStr(a.OAuth2, "accessToken"),
			TokenType:   authParamStr(a.OAuth2, "tokenType"),
			AddTokenTo:  authParamStr(a.OAuth2, "addTokenTo"),
		}
	case parser.AuthTypeHawk:
		fa.Type = "hawk"
		fa.Hawk = &feAuthHawk{
			AuthID:    authParamStr(a.Hawk, "authId"),
			AuthKey:   authParamStr(a.Hawk, "authKey"),
			Algorithm: authParamStr(a.Hawk, "algorithm"),
		}
	case parser.AuthTypeAWSV4:
		fa.Type = "aws-signature"
		fa.AWSSignature = &feAuthAWSSignature{
			AccessKey:    authParamStr(a.AWSV4, "accessKey"),
			SecretKey:    authParamStr(a.AWSV4, "secretKey"),
			Region:       authParamStr(a.AWSV4, "region"),
			Service:      authParamStr(a.AWSV4, "service"),
			SessionToken: authParamStr(a.AWSV4, "sessionToken"),
		}
	case parser.AuthTypeNTLM:
		fa.Type = "ntlm"
		fa.NTLM = &feAuthNTLM{
			Username:    authParamStr(a.NTLM, "username"),
			Password:    authParamStr(a.NTLM, "password"),
			Domain:      authParamStr(a.NTLM, "domain"),
			Workstation: authParamStr(a.NTLM, "workstation"),
		}
	default:
		fa.Type = "none"
	}
	return fa
}

func convertAuthToParser(fa feAuth) *parser.Auth {
	switch fa.Type {
	case "none":
		return &parser.Auth{Type: parser.AuthTypeNoAuth}
	case "inherit":
		return nil
	case "bearer":
		var params []parser.AuthParam
		if fa.Bearer != nil {
			params = []parser.AuthParam{{Key: "token", Value: fa.Bearer.Token, Type: "string"}}
		}
		return &parser.Auth{Type: parser.AuthTypeBearer, Bearer: params}
	case "basic":
		var params []parser.AuthParam
		if fa.Basic != nil {
			params = []parser.AuthParam{
				{Key: "username", Value: fa.Basic.Username, Type: "string"},
				{Key: "password", Value: fa.Basic.Password, Type: "string"},
			}
		}
		return &parser.Auth{Type: parser.AuthTypeBasic, Basic: params}
	case "api-key":
		var params []parser.AuthParam
		if fa.APIKey != nil {
			params = []parser.AuthParam{
				{Key: "key", Value: fa.APIKey.Key, Type: "string"},
				{Key: "value", Value: fa.APIKey.Value, Type: "string"},
				{Key: "in", Value: fa.APIKey.AddTo, Type: "string"},
			}
		}
		return &parser.Auth{Type: parser.AuthTypeAPIKey, APIKey: params}
	case "digest":
		var params []parser.AuthParam
		if fa.Digest != nil {
			params = []parser.AuthParam{
				{Key: "username", Value: fa.Digest.Username, Type: "string"},
				{Key: "password", Value: fa.Digest.Password, Type: "string"},
			}
		}
		return &parser.Auth{Type: parser.AuthTypeDigest, Digest: params}
	case "oauth1":
		var params []parser.AuthParam
		if fa.OAuth1 != nil {
			params = []parser.AuthParam{
				{Key: "consumerKey", Value: fa.OAuth1.ConsumerKey, Type: "string"},
				{Key: "consumerSecret", Value: fa.OAuth1.ConsumerSecret, Type: "string"},
				{Key: "token", Value: fa.OAuth1.Token, Type: "string"},
				{Key: "tokenSecret", Value: fa.OAuth1.TokenSecret, Type: "string"},
				{Key: "signatureMethod", Value: fa.OAuth1.SignatureMethod, Type: "string"},
			}
		}
		return &parser.Auth{Type: parser.AuthTypeOAuth1, OAuth1: params}
	case "oauth2":
		var params []parser.AuthParam
		if fa.OAuth2 != nil {
			params = []parser.AuthParam{
				{Key: "grant_type", Value: fa.OAuth2.GrantType, Type: "string"},
				{Key: "accessToken", Value: fa.OAuth2.AccessToken, Type: "string"},
				{Key: "tokenType", Value: fa.OAuth2.TokenType, Type: "string"},
				{Key: "addTokenTo", Value: fa.OAuth2.AddTokenTo, Type: "string"},
			}
		}
		return &parser.Auth{Type: parser.AuthTypeOAuth2, OAuth2: params}
	case "hawk":
		var params []parser.AuthParam
		if fa.Hawk != nil {
			params = []parser.AuthParam{
				{Key: "authId", Value: fa.Hawk.AuthID, Type: "string"},
				{Key: "authKey", Value: fa.Hawk.AuthKey, Type: "string"},
				{Key: "algorithm", Value: fa.Hawk.Algorithm, Type: "string"},
			}
		}
		return &parser.Auth{Type: parser.AuthTypeHawk, Hawk: params}
	case "aws-signature":
		var params []parser.AuthParam
		if fa.AWSSignature != nil {
			params = []parser.AuthParam{
				{Key: "accessKey", Value: fa.AWSSignature.AccessKey, Type: "string"},
				{Key: "secretKey", Value: fa.AWSSignature.SecretKey, Type: "string"},
				{Key: "region", Value: fa.AWSSignature.Region, Type: "string"},
				{Key: "service", Value: fa.AWSSignature.Service, Type: "string"},
				{Key: "sessionToken", Value: fa.AWSSignature.SessionToken, Type: "string"},
			}
		}
		return &parser.Auth{Type: parser.AuthTypeAWSV4, AWSV4: params}
	case "ntlm":
		var params []parser.AuthParam
		if fa.NTLM != nil {
			params = []parser.AuthParam{
				{Key: "username", Value: fa.NTLM.Username, Type: "string"},
				{Key: "password", Value: fa.NTLM.Password, Type: "string"},
				{Key: "domain", Value: fa.NTLM.Domain, Type: "string"},
				{Key: "workstation", Value: fa.NTLM.Workstation, Type: "string"},
			}
		}
		return &parser.Auth{Type: parser.AuthTypeNTLM, NTLM: params}
	default:
		return nil
	}
}

// --- body conversion ---

func rawContentType(opts *parser.BodyOptions) string {
	if opts != nil && opts.Raw != nil {
		switch opts.Raw.Language {
		case "json":
			return "application/json"
		case "xml":
			return "application/xml"
		case "text":
			return "text/plain"
		case "html":
			return "text/html"
		case "javascript":
			return "application/javascript"
		}
	}
	return "application/json"
}

func rawContentTypeToLanguage(ct string) string {
	switch ct {
	case "application/xml":
		return "xml"
	case "text/plain":
		return "text"
	case "text/html":
		return "html"
	case "application/javascript":
		return "javascript"
	default:
		return "json"
	}
}

func convertBodyToFrontend(b *parser.Body) feBody {
	if b == nil {
		return feBody{
			Type:           "none",
			Raw:            "",
			RawContentType: "application/json",
			FormData:       make([]feFormDataItem, 0),
			URLEncoded:     make([]feKV, 0),
		}
	}
	fb := feBody{
		FormData:   make([]feFormDataItem, 0),
		URLEncoded: make([]feKV, 0),
	}
	switch b.Mode {
	case parser.BodyModeRaw:
		fb.Type = "raw"
		fb.Raw = b.Raw
		fb.RawContentType = rawContentType(b.Options)
	case parser.BodyModeFormData:
		fb.Type = "form-data"
		fb.RawContentType = "application/json"
		for _, p := range b.FormData {
			vt := p.Type
			if vt == "" {
				vt = "text"
			}
			fb.FormData = append(fb.FormData, feFormDataItem{
				ID:        newID(),
				Key:       p.Key,
				ValueType: vt,
				Value:     p.Value,
				FileName:  p.Src,
				Enabled:   !p.Disabled,
			})
		}
	case parser.BodyModeURLEncoded:
		fb.Type = "x-www-form-urlencoded"
		fb.RawContentType = "application/json"
		for _, p := range b.URLEncoded {
			fb.URLEncoded = append(fb.URLEncoded, feKV{
				ID:      newID(),
				Key:     p.Key,
				Value:   p.Value,
				Enabled: !p.Disabled,
			})
		}
	case parser.BodyModeGraphQL:
		fb.Type = "graphql"
		fb.RawContentType = "application/json"
		if b.GraphQL != nil {
			fb.GraphQLQuery = b.GraphQL.Query
			fb.GraphQLVars = b.GraphQL.Variables
		}
	case parser.BodyModeFile:
		fb.Type = "binary"
		fb.RawContentType = "application/json"
	default:
		fb.Type = "none"
		fb.RawContentType = "application/json"
	}
	return fb
}

func convertBodyToParser(fb feBody) *parser.Body {
	switch fb.Type {
	case "none", "":
		return nil
	case "raw":
		lang := rawContentTypeToLanguage(fb.RawContentType)
		return &parser.Body{
			Mode: parser.BodyModeRaw,
			Raw:  fb.Raw,
			Options: &parser.BodyOptions{
				Raw: &parser.RawOptions{Language: lang},
			},
		}
	case "form-data":
		params := make([]parser.FormDataParam, 0, len(fb.FormData))
		for _, p := range fb.FormData {
			params = append(params, parser.FormDataParam{
				Key:      p.Key,
				Value:    p.Value,
				Src:      p.FileName,
				Type:     p.ValueType,
				Disabled: !p.Enabled,
			})
		}
		return &parser.Body{Mode: parser.BodyModeFormData, FormData: params}
	case "x-www-form-urlencoded":
		params := make([]parser.URLEncodedParam, 0, len(fb.URLEncoded))
		for _, p := range fb.URLEncoded {
			params = append(params, parser.URLEncodedParam{
				Key:      p.Key,
				Value:    p.Value,
				Disabled: !p.Enabled,
			})
		}
		return &parser.Body{Mode: parser.BodyModeURLEncoded, URLEncoded: params}
	case "graphql":
		return &parser.Body{
			Mode:    parser.BodyModeGraphQL,
			GraphQL: &parser.GraphQLBody{Query: fb.GraphQLQuery, Variables: fb.GraphQLVars},
		}
	case "binary":
		return &parser.Body{Mode: parser.BodyModeFile}
	default:
		return nil
	}
}

// --- item conversion ---

func convertItemToFrontend(item parser.Item) json.RawMessage {
	if item.IsFolder() {
		items := make([]json.RawMessage, 0, len(item.Item))
		for _, child := range item.Item {
			items = append(items, convertItemToFrontend(child))
		}
		folder := struct {
			ID               string            `json:"id"`
			Name             string            `json:"name"`
			Auth             feAuth            `json:"auth"`
			PreRequestScript string            `json:"preRequestScript"`
			TestScript       string            `json:"testScript"`
			Items            []json.RawMessage `json:"items"`
		}{
			ID:               newID(),
			Name:             item.Name,
			Auth:             convertAuthToFrontend(item.Auth, false),
			PreRequestScript: extractScript(item.Event, "prerequest"),
			TestScript:       extractScript(item.Event, "test"),
			Items:            items,
		}
		b, _ := json.Marshal(folder)
		return b
	}

	req := item.Request
	params := make([]feKV, 0)
	headers := make([]feKV, 0)
	var body feBody

	if req != nil {
		for _, q := range req.URL.Query {
			params = append(params, feKV{
				ID:      newID(),
				Key:     q.Key,
				Value:   q.Value,
				Enabled: !q.Disabled,
			})
		}
		for _, h := range req.Header {
			headers = append(headers, feKV{
				ID:      newID(),
				Key:     h.Key,
				Value:   h.Value,
				Enabled: !h.Disabled,
			})
		}
		body = convertBodyToFrontend(req.Body)
	} else {
		body = convertBodyToFrontend(nil)
	}

	var method, rawURL string
	var auth feAuth
	if req != nil {
		method = req.Method
		rawURL = req.URL.Raw
		auth = convertAuthToFrontend(req.Auth, false)
	} else {
		method = "GET"
		auth = feAuth{Type: "inherit"}
	}

	request := struct {
		ID               string `json:"id"`
		Name             string `json:"name"`
		Method           string `json:"method"`
		URL              string `json:"url"`
		Params           []feKV `json:"params"`
		Headers          []feKV `json:"headers"`
		Body             feBody `json:"body"`
		Auth             feAuth `json:"auth"`
		PreRequestScript string `json:"preRequestScript"`
		TestScript       string `json:"testScript"`
	}{
		ID:               newID(),
		Name:             item.Name,
		Method:           method,
		URL:              rawURL,
		Params:           params,
		Headers:          headers,
		Body:             body,
		Auth:             auth,
		PreRequestScript: extractScript(item.Event, "prerequest"),
		TestScript:       extractScript(item.Event, "test"),
	}
	b, _ := json.Marshal(request)
	return b
}

// --- collection conversion ---

// CollectionToFrontend converts a parser.Collection to the frontend JSON format.
func CollectionToFrontend(col *parser.Collection) (json.RawMessage, error) {
	vars := make([]feVariable, 0, len(col.Variable))
	for _, v := range col.Variable {
		vars = append(vars, feVariable{
			ID:           newID(),
			Key:          v.Key,
			InitialValue: v.Value,
			CurrentValue: v.Value,
			Enabled:      !v.Disabled,
		})
	}

	items := make([]json.RawMessage, 0, len(col.Item))
	for _, item := range col.Item {
		items = append(items, convertItemToFrontend(item))
	}

	out := struct {
		ID               string            `json:"id"`
		Name             string            `json:"name"`
		Description      string            `json:"description"`
		Auth             feAuth            `json:"auth"`
		Variables        []feVariable      `json:"variables"`
		PreRequestScript string            `json:"preRequestScript"`
		TestScript       string            `json:"testScript"`
		Items            []json.RawMessage `json:"items"`
	}{
		ID:               orID(col.Info.PostmanID),
		Name:             col.Info.Name,
		Description:      col.Info.Description,
		Auth:             convertAuthToFrontend(col.Auth, true),
		Variables:        vars,
		PreRequestScript: extractScript(col.Event, "prerequest"),
		TestScript:       extractScript(col.Event, "test"),
		Items:            items,
	}
	return json.Marshal(out)
}

// --- frontend → parser (for export) ---

type feCollectionIn struct {
	ID               string            `json:"id"`
	Name             string            `json:"name"`
	Description      string            `json:"description"`
	Auth             feAuth            `json:"auth"`
	Variables        []feVariable      `json:"variables"`
	PreRequestScript string            `json:"preRequestScript"`
	TestScript       string            `json:"testScript"`
	Items            []json.RawMessage `json:"items"`
}

type feRequestIn struct {
	ID               string `json:"id"`
	Name             string `json:"name"`
	Method           string `json:"method"`
	URL              string `json:"url"`
	Params           []feKV `json:"params"`
	Headers          []feKV `json:"headers"`
	Body             feBody `json:"body"`
	Auth             feAuth `json:"auth"`
	PreRequestScript string `json:"preRequestScript"`
	TestScript       string `json:"testScript"`
}

type feFolderIn struct {
	ID               string            `json:"id"`
	Name             string            `json:"name"`
	Auth             feAuth            `json:"auth"`
	PreRequestScript string            `json:"preRequestScript"`
	TestScript       string            `json:"testScript"`
	Items            []json.RawMessage `json:"items"`
}

func convertItemToParser(raw json.RawMessage) (parser.Item, error) {
	// probe for "method" to distinguish request from folder
	var probe struct {
		Method string `json:"method"`
	}
	if err := json.Unmarshal(raw, &probe); err != nil {
		return parser.Item{}, fmt.Errorf("probe item: %w", err)
	}

	if probe.Method != "" {
		var req feRequestIn
		if err := json.Unmarshal(raw, &req); err != nil {
			return parser.Item{}, fmt.Errorf("unmarshal request: %w", err)
		}
		headers := make([]parser.Header, 0, len(req.Headers))
		for _, h := range req.Headers {
			headers = append(headers, parser.Header{
				Key:      h.Key,
				Value:    h.Value,
				Disabled: !h.Enabled,
			})
		}
		query := make([]parser.QueryParam, 0, len(req.Params))
		for _, p := range req.Params {
			query = append(query, parser.QueryParam{
				Key:      p.Key,
				Value:    p.Value,
				Disabled: !p.Enabled,
			})
		}
		return parser.Item{
			Name: req.Name,
			Request: &parser.Request{
				Method: req.Method,
				URL:    parser.URL{Raw: req.URL, Query: query},
				Header: headers,
				Body:   convertBodyToParser(req.Body),
				Auth:   convertAuthToParser(req.Auth),
			},
			Event: buildEvents(req.PreRequestScript, req.TestScript),
			Auth:  convertAuthToParser(req.Auth),
		}, nil
	}

	var folder feFolderIn
	if err := json.Unmarshal(raw, &folder); err != nil {
		return parser.Item{}, fmt.Errorf("unmarshal folder: %w", err)
	}
	children := make([]parser.Item, 0, len(folder.Items))
	for _, childRaw := range folder.Items {
		child, err := convertItemToParser(childRaw)
		if err != nil {
			return parser.Item{}, err
		}
		children = append(children, child)
	}
	return parser.Item{
		Name:  folder.Name,
		Item:  children,
		Auth:  convertAuthToParser(folder.Auth),
		Event: buildEvents(folder.PreRequestScript, folder.TestScript),
	}, nil
}

// CollectionToParser converts a frontend JSON collection to a parser.Collection.
func CollectionToParser(data json.RawMessage) (*parser.Collection, error) {
	var fc feCollectionIn
	if err := json.Unmarshal(data, &fc); err != nil {
		return nil, fmt.Errorf("unmarshal collection: %w", err)
	}

	vars := make([]parser.Variable, 0, len(fc.Variables))
	for _, v := range fc.Variables {
		vars = append(vars, parser.Variable{
			Key:      v.Key,
			Value:    v.InitialValue,
			Disabled: !v.Enabled,
		})
	}

	items := make([]parser.Item, 0, len(fc.Items))
	for _, raw := range fc.Items {
		item, err := convertItemToParser(raw)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}

	return &parser.Collection{
		Info: parser.Info{
			PostmanID: fc.ID,
			Name:      fc.Name,
			Schema:    "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
		},
		Auth:     convertAuthToParser(fc.Auth),
		Variable: vars,
		Item:     items,
		Event:    buildEvents(fc.PreRequestScript, fc.TestScript),
	}, nil
}

// --- environment conversion ---

// EnvironmentToFrontend converts a parser.Environment to the frontend JSON format.
func EnvironmentToFrontend(env *parser.Environment) (json.RawMessage, error) {
	vars := make([]feVariable, 0, len(env.Values))
	for _, v := range env.Values {
		vars = append(vars, feVariable{
			ID:           newID(),
			Key:          v.Key,
			InitialValue: v.Value,
			CurrentValue: v.Value,
			Enabled:      v.Enabled,
		})
	}

	out := struct {
		ID        string       `json:"id"`
		Name      string       `json:"name"`
		Variables []feVariable `json:"variables"`
	}{
		ID:        orID(env.ID),
		Name:      env.Name,
		Variables: vars,
	}
	return json.Marshal(out)
}

type feEnvironmentIn struct {
	ID        string       `json:"id"`
	Name      string       `json:"name"`
	Variables []feVariable `json:"variables"`
}

// EnvironmentToParser converts a frontend JSON environment to a parser.Environment.
func EnvironmentToParser(data json.RawMessage) (*parser.Environment, error) {
	var fe feEnvironmentIn
	if err := json.Unmarshal(data, &fe); err != nil {
		return nil, fmt.Errorf("unmarshal environment: %w", err)
	}

	values := make([]parser.EnvironmentValue, 0, len(fe.Variables))
	for _, v := range fe.Variables {
		values = append(values, parser.EnvironmentValue{
			Key:     v.Key,
			Value:   v.InitialValue,
			Enabled: v.Enabled,
			Type:    "default",
		})
	}

	return &parser.Environment{
		ID:     fe.ID,
		Name:   fe.Name,
		Values: values,
	}, nil
}
