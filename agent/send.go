package main

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	engineauth "github.com/guillaumedelre/reqlet/engine/auth"
	enginehttp "github.com/guillaumedelre/reqlet/engine/http"
	"github.com/guillaumedelre/reqlet/engine/parser"
	"github.com/guillaumedelre/reqlet/engine/sandbox"
	"github.com/guillaumedelre/reqlet/engine/variables"
)

type sendVariables struct {
	Globals             map[string]string `json:"globals,omitempty"`
	Environment         map[string]string `json:"environment,omitempty"`
	CollectionVariables map[string]string `json:"collectionVariables,omitempty"`
}

type sendMutations struct {
	Globals             map[string]string `json:"globals,omitempty"`
	Environment         map[string]string `json:"environment,omitempty"`
	CollectionVariables map[string]string `json:"collectionVariables,omitempty"`
}

type sendTimings struct {
	DNS      int64 `json:"dns"`
	TCP      int64 `json:"tcp"`
	TLS      int64 `json:"tls"`
	TTFB     int64 `json:"ttfb"`
	Download int64 `json:"download"`
	Total    int64 `json:"total"`
}

type sendReq struct {
	Method               string        `json:"method"`
	URL                  string        `json:"url"`
	Headers              []kvItem      `json:"headers"`
	BodyType             string        `json:"bodyType"`
	BodyRaw              string        `json:"bodyRaw"`
	BodyRawContentType   string        `json:"bodyRawContentType"`
	BodyFormData         []kvItem      `json:"bodyFormData"`
	BodyUrlencoded       []kvItem      `json:"bodyUrlencoded"`
	BodyGraphQLQuery     string        `json:"bodyGraphQLQuery"`
	BodyGraphQLVariables string        `json:"bodyGraphQLVariables"`
	Auth                 *authCfg      `json:"auth,omitempty"`
	FollowRedirects      bool          `json:"followRedirects"`
	SslVerification      bool          `json:"sslVerification"`
	Timeout              int           `json:"timeout"` // milliseconds, 0 = no timeout
	IgnoreProxy          bool          `json:"ignoreProxy"`
	PreRequestScript     string        `json:"preRequestScript,omitempty"`
	TestScript           string        `json:"testScript,omitempty"`
	Variables            sendVariables `json:"variables,omitempty"`
	RequestName          string        `json:"requestName,omitempty"`
	RequestID            string        `json:"requestId,omitempty"`
}

type kvItem struct {
	Key         string `json:"key"`
	Value       string `json:"value"`
	Enabled     bool   `json:"enabled"`
	ValueType   string `json:"valueType,omitempty"`   // "text" | "file"
	FileName    string `json:"fileName,omitempty"`    // original filename for file items
	FileContent string `json:"fileContent,omitempty"` // base64-encoded content for file items
}

// authCfg mirrors the frontend AuthConfig type.
type authCfg struct {
	Type   string          `json:"type"`
	Bearer *bearerCfg      `json:"bearer,omitempty"`
	Basic  *credentialsCfg `json:"basic,omitempty"`
	APIKey *apiKeyCfg      `json:"apiKey,omitempty"`
	Digest *credentialsCfg `json:"digest,omitempty"`
	OAuth2 *oauth2Cfg      `json:"oauth2,omitempty"`
	AwsSig *awsSigCfg      `json:"awsSignature,omitempty"`
}

type bearerCfg struct {
	Token string `json:"token"`
}

type credentialsCfg struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type apiKeyCfg struct {
	Key   string `json:"key"`
	Value string `json:"value"`
	AddTo string `json:"addTo"`
}

type oauth2Cfg struct {
	AccessToken string `json:"accessToken"`
	TokenType   string `json:"tokenType"`
	AddTokenTo  string `json:"addTokenTo"`
}

type awsSigCfg struct {
	AccessKey    string `json:"accessKey"`
	SecretKey    string `json:"secretKey"`
	Region       string `json:"region"`
	Service      string `json:"service"`
	SessionToken string `json:"sessionToken,omitempty"`
}

type sendResp struct {
	Status          int                  `json:"status"`
	StatusText      string               `json:"statusText"`
	Time            int64                `json:"time"` // milliseconds
	Size            int                  `json:"size"`
	Headers         map[string]string    `json:"headers"`
	Body            string               `json:"body"`
	ContentType     string               `json:"contentType"`
	Timings         sendTimings          `json:"timings"`
	TestResults     []sandbox.TestResult `json:"testResults,omitempty"`
	PreRequestError string               `json:"preRequestError,omitempty"`
	TestError       string               `json:"testError,omitempty"`
	Mutations       *sendMutations       `json:"mutations,omitempty"`
}

type errResp struct {
	Error string `json:"error"`
	Code  string `json:"code"`
}

func (s *server) handleSend(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, errResp{Error: "method not allowed", Code: "bad_request"})
		return
	}

	var req sendReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, errResp{Error: "invalid request body: " + err.Error(), Code: "bad_request"})
		return
	}

	ctx := r.Context()
	if req.RequestID != "" {
		var cancel context.CancelFunc
		ctx, cancel = context.WithCancel(ctx)
		s.cancels.Store(req.RequestID, cancel)
		defer func() {
			cancel()
			s.cancels.Delete(req.RequestID)
		}()
	}

	var preResult *sandbox.ScriptResult
	var preReqErr string

	if s.sandbox != nil && req.PreRequestScript != "" {
		sctx := buildScriptContext(req, "prerequest", nil)
		res, err := s.sandbox.Execute(ctx, req.PreRequestScript, "prerequest", sctx)
		if err != nil {
			preReqErr = err.Error()
		} else {
			preResult = res
			if res.Mutations.SkipRequest {
				writeJSON(w, http.StatusOK, sendResp{
					PreRequestError: preReqErr,
					Mutations:       mutsToSend(res.Mutations),
				})
				return
			}
		}
	}

	opts := enginehttp.DefaultOptions()
	opts.FollowRedirects = req.FollowRedirects
	opts.Insecure = !req.SslVerification
	if req.Timeout > 0 {
		opts.Timeout = time.Duration(req.Timeout) * time.Millisecond
	} else {
		opts.Timeout = 0
	}

	client, err := enginehttp.NewClient(opts)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, errResp{Error: err.Error(), Code: "internal_error"})
		return
	}

	applier, err := engineauth.New(toParserAuth(req.Auth))
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, errResp{Error: err.Error(), Code: "internal_error"})
		return
	}

	parsedReq := buildParserReq(req)
	resolver := variables.NewResolver()

	resp, err := client.Execute(ctx, parsedReq, resolver, applier)
	if err != nil {
		writeJSON(w, http.StatusUnprocessableEntity, errResp{Error: err.Error(), Code: networkErrorCode(err)})
		return
	}

	headers := make(map[string]string, len(resp.Headers))
	for k, vs := range resp.Headers {
		if len(vs) > 0 {
			headers[k] = vs[0]
		}
	}

	var testResult *sandbox.ScriptResult
	var testErr string

	if s.sandbox != nil && req.TestScript != "" {
		sctx := buildScriptContext(req, "test", &sandbox.ResponseInfo{
			Status:       http.StatusText(resp.StatusCode),
			Code:         resp.StatusCode,
			ResponseTime: resp.Duration.Milliseconds(),
			ResponseSize: len(resp.Body),
			Headers:      headers,
			Body:         string(resp.Body),
		})
		if preResult != nil {
			applyMutsToCtx(sctx, preResult.Mutations)
		}
		res, err := s.sandbox.Execute(ctx, req.TestScript, "test", sctx)
		if err != nil {
			testErr = err.Error()
		} else {
			testResult = res
		}
	}

	result := sendResp{
		Status:      resp.StatusCode,
		StatusText:  http.StatusText(resp.StatusCode),
		Time:        resp.Duration.Milliseconds(),
		Size:        len(resp.Body),
		Headers:     headers,
		Body:        string(resp.Body),
		ContentType: resp.Headers.Get("Content-Type"),
		Timings: sendTimings{
			DNS:      resp.Timings.DNS.Milliseconds(),
			TCP:      resp.Timings.TCP.Milliseconds(),
			TLS:      resp.Timings.TLS.Milliseconds(),
			TTFB:     resp.Timings.TTFB.Milliseconds(),
			Download: resp.Timings.Download.Milliseconds(),
			Total:    resp.Timings.Total.Milliseconds(),
		},
		PreRequestError: preReqErr,
		TestError:       testErr,
	}
	if testResult != nil {
		result.TestResults = testResult.Tests
	}
	result.Mutations = mergeMutations(preResult, testResult)

	writeJSON(w, http.StatusOK, result)
}

func copyMap(m map[string]string) map[string]string {
	c := make(map[string]string, len(m))
	for k, v := range m {
		c[k] = v
	}
	return c
}

func buildScriptContext(req sendReq, event string, response *sandbox.ResponseInfo) *sandbox.ScriptContext {
	return &sandbox.ScriptContext{
		Globals:             copyMap(req.Variables.Globals),
		Environment:         copyMap(req.Variables.Environment),
		CollectionVariables: copyMap(req.Variables.CollectionVariables),
		IterationData:       map[string]string{},
		Request: &sandbox.RequestInfo{
			URL:     req.URL,
			Method:  req.Method,
			Headers: kvItemsToHeaderMap(req.Headers),
			Body:    req.BodyRaw,
		},
		Response: response,
		Info: sandbox.ExecInfo{
			EventName:   event,
			RequestName: req.RequestName,
			RequestID:   req.RequestID,
		},
	}
}

func applyMutsToCtx(sctx *sandbox.ScriptContext, m sandbox.Mutations) {
	for k, v := range m.Globals {
		sctx.Globals[k] = v
	}
	for k, v := range m.Environment {
		sctx.Environment[k] = v
	}
	for k, v := range m.CollectionVariables {
		sctx.CollectionVariables[k] = v
	}
}

func mutsToSend(m sandbox.Mutations) *sendMutations {
	if len(m.Globals)+len(m.Environment)+len(m.CollectionVariables) == 0 {
		return nil
	}
	s := &sendMutations{}
	if len(m.Globals) > 0 {
		s.Globals = m.Globals
	}
	if len(m.Environment) > 0 {
		s.Environment = m.Environment
	}
	if len(m.CollectionVariables) > 0 {
		s.CollectionVariables = m.CollectionVariables
	}
	return s
}

func mergeMutations(pre, test *sandbox.ScriptResult) *sendMutations {
	globals := map[string]string{}
	env := map[string]string{}
	colVars := map[string]string{}

	if pre != nil {
		for k, v := range pre.Mutations.Globals {
			globals[k] = v
		}
		for k, v := range pre.Mutations.Environment {
			env[k] = v
		}
		for k, v := range pre.Mutations.CollectionVariables {
			colVars[k] = v
		}
	}
	if test != nil {
		// test mutations override pre-request mutations
		for k, v := range test.Mutations.Globals {
			globals[k] = v
		}
		for k, v := range test.Mutations.Environment {
			env[k] = v
		}
		for k, v := range test.Mutations.CollectionVariables {
			colVars[k] = v
		}
	}

	if len(globals)+len(env)+len(colVars) == 0 {
		return nil
	}
	s := &sendMutations{}
	if len(globals) > 0 {
		s.Globals = globals
	}
	if len(env) > 0 {
		s.Environment = env
	}
	if len(colVars) > 0 {
		s.CollectionVariables = colVars
	}
	return s
}

func kvItemsToHeaderMap(items []kvItem) map[string]string {
	m := make(map[string]string, len(items))
	for _, h := range items {
		if h.Enabled && h.Key != "" {
			m[h.Key] = h.Value
		}
	}
	return m
}

func buildParserReq(req sendReq) *parser.Request {
	pr := &parser.Request{
		Method: req.Method,
		URL:    parser.URL{Raw: req.URL},
	}

	for _, h := range req.Headers {
		if !h.Enabled || h.Key == "" {
			continue
		}
		pr.Header = append(pr.Header, parser.Header{Key: h.Key, Value: h.Value})
	}

	switch req.BodyType {
	case "raw":
		pr.Body = &parser.Body{
			Mode: parser.BodyModeRaw,
			Raw:  req.BodyRaw,
			Options: &parser.BodyOptions{
				Raw: &parser.RawOptions{Language: rawLang(req.BodyRawContentType)},
			},
		}
	case "form-data":
		var items []parser.FormDataParam
		for _, item := range req.BodyFormData {
			if !item.Enabled || item.Key == "" {
				continue
			}
			if item.ValueType == "file" {
				items = append(items, parser.FormDataParam{
					Key:   item.Key,
					Value: item.FileContent,
					Src:   item.FileName,
					Type:  "file",
				})
			} else {
				items = append(items, parser.FormDataParam{Key: item.Key, Value: item.Value, Type: "text"})
			}
		}
		pr.Body = &parser.Body{Mode: parser.BodyModeFormData, FormData: items}
	case "urlencoded", "x-www-form-urlencoded":
		var items []parser.URLEncodedParam
		for _, item := range req.BodyUrlencoded {
			if item.Enabled && item.Key != "" {
				items = append(items, parser.URLEncodedParam{Key: item.Key, Value: item.Value})
			}
		}
		pr.Body = &parser.Body{Mode: parser.BodyModeURLEncoded, URLEncoded: items}
	case "graphql":
		pr.Body = &parser.Body{
			Mode: parser.BodyModeGraphQL,
			GraphQL: &parser.GraphQLBody{
				Query:     req.BodyGraphQLQuery,
				Variables: req.BodyGraphQLVariables,
			},
		}
	}

	return pr
}

// toParserAuth converts the frontend auth config into the engine/parser.Auth format.
func toParserAuth(a *authCfg) *parser.Auth {
	if a == nil {
		return nil
	}
	switch a.Type {
	case "none", "inherit", "":
		return &parser.Auth{Type: parser.AuthTypeNoAuth}
	case "bearer":
		if a.Bearer == nil {
			return &parser.Auth{Type: parser.AuthTypeBearer}
		}
		return &parser.Auth{
			Type:   parser.AuthTypeBearer,
			Bearer: []parser.AuthParam{{Key: "token", Value: a.Bearer.Token, Type: "string"}},
		}
	case "basic":
		if a.Basic == nil {
			return &parser.Auth{Type: parser.AuthTypeBasic}
		}
		return &parser.Auth{
			Type: parser.AuthTypeBasic,
			Basic: []parser.AuthParam{
				{Key: "username", Value: a.Basic.Username, Type: "string"},
				{Key: "password", Value: a.Basic.Password, Type: "string"},
			},
		}
	case "digest":
		if a.Digest == nil {
			return &parser.Auth{Type: parser.AuthTypeDigest}
		}
		return &parser.Auth{
			Type: parser.AuthTypeDigest,
			Digest: []parser.AuthParam{
				{Key: "username", Value: a.Digest.Username, Type: "string"},
				{Key: "password", Value: a.Digest.Password, Type: "string"},
			},
		}
	case "api-key":
		if a.APIKey == nil {
			return &parser.Auth{Type: parser.AuthTypeAPIKey}
		}
		return &parser.Auth{
			Type: parser.AuthTypeAPIKey,
			APIKey: []parser.AuthParam{
				{Key: "key", Value: a.APIKey.Key, Type: "string"},
				{Key: "value", Value: a.APIKey.Value, Type: "string"},
				{Key: "in", Value: a.APIKey.AddTo, Type: "string"},
			},
		}
	case "oauth2":
		if a.OAuth2 == nil {
			return &parser.Auth{Type: parser.AuthTypeOAuth2}
		}
		return &parser.Auth{
			Type: parser.AuthTypeOAuth2,
			OAuth2: []parser.AuthParam{
				{Key: "accessToken", Value: a.OAuth2.AccessToken, Type: "string"},
				{Key: "tokenType", Value: a.OAuth2.TokenType, Type: "string"},
				{Key: "addTokenTo", Value: a.OAuth2.AddTokenTo, Type: "string"},
			},
		}
	case "aws-signature":
		if a.AwsSig == nil {
			return &parser.Auth{Type: parser.AuthTypeAWSV4}
		}
		params := []parser.AuthParam{
			{Key: "accessKey", Value: a.AwsSig.AccessKey, Type: "string"},
			{Key: "secretKey", Value: a.AwsSig.SecretKey, Type: "string"},
			{Key: "region", Value: a.AwsSig.Region, Type: "string"},
			{Key: "service", Value: a.AwsSig.Service, Type: "string"},
		}
		if a.AwsSig.SessionToken != "" {
			params = append(params, parser.AuthParam{Key: "sessionToken", Value: a.AwsSig.SessionToken, Type: "string"})
		}
		return &parser.Auth{Type: parser.AuthTypeAWSV4, AWSV4: params}
	default:
		// jwt, hawk, oauth1, ntlm, akamai-edgegrid, asap: not yet in engine/auth
		return &parser.Auth{Type: parser.AuthTypeNoAuth}
	}
}

func rawLang(contentType string) string {
	switch contentType {
	case "application/json", "JSON":
		return "json"
	case "application/xml", "XML":
		return "xml"
	case "text/html", "HTML":
		return "html"
	case "application/javascript", "JavaScript":
		return "javascript"
	default:
		return "text"
	}
}

func networkErrorCode(err error) string {
	msg := err.Error()
	switch {
	case strings.Contains(msg, "timeout") || strings.Contains(msg, "deadline exceeded"):
		return "timeout"
	case strings.Contains(msg, "tls") || strings.Contains(msg, "certificate"):
		return "tls_error"
	case strings.Contains(msg, "no such host"):
		return "dns_error"
	default:
		return "network_error"
	}
}

func (s *server) cancelSend(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	v, ok := s.cancels.LoadAndDelete(id)
	if !ok {
		writeJSON(w, http.StatusNotFound, errResp{Error: "no active request with id " + id, Code: "not_found"})
		return
	}
	v.(context.CancelFunc)()
	w.WriteHeader(http.StatusNoContent)
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
