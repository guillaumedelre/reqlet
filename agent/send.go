package main

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"

	enginehttp "github.com/guillaumedelre/reqlet/engine/http"
	"github.com/guillaumedelre/reqlet/engine/parser"
	"github.com/guillaumedelre/reqlet/engine/variables"
)

type sendReq struct {
	Method             string   `json:"method"`
	URL                string   `json:"url"`
	Headers            []kvItem `json:"headers"`
	BodyType           string   `json:"bodyType"`
	BodyRaw            string   `json:"bodyRaw"`
	BodyRawContentType string   `json:"bodyRawContentType"`
	BodyFormData       []kvItem `json:"bodyFormData"`
	BodyUrlencoded     []kvItem `json:"bodyUrlencoded"`
	FollowRedirects    bool     `json:"followRedirects"`
	SslVerification    bool     `json:"sslVerification"`
	Timeout            int      `json:"timeout"` // milliseconds, 0 = no timeout
	IgnoreProxy        bool     `json:"ignoreProxy"`
}

type kvItem struct {
	Key     string `json:"key"`
	Value   string `json:"value"`
	Enabled bool   `json:"enabled"`
}

type sendResp struct {
	Status      int               `json:"status"`
	StatusText  string            `json:"statusText"`
	Time        int64             `json:"time"` // milliseconds
	Size        int               `json:"size"`
	Headers     map[string]string `json:"headers"`
	Body        string            `json:"body"`
	ContentType string            `json:"contentType"`
}

type errResp struct {
	Error string `json:"error"`
	Code  string `json:"code"`
}

func handleSend(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, errResp{Error: "method not allowed", Code: "bad_request"})
		return
	}

	var req sendReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, errResp{Error: "invalid request body: " + err.Error(), Code: "bad_request"})
		return
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

	parsedReq := buildParserReq(req)
	resolver := variables.NewResolver()

	resp, err := client.Execute(r.Context(), parsedReq, resolver, nil)
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

	writeJSON(w, http.StatusOK, sendResp{
		Status:      resp.StatusCode,
		StatusText:  resp.Status,
		Time:        resp.Duration.Milliseconds(),
		Size:        len(resp.Body),
		Headers:     headers,
		Body:        string(resp.Body),
		ContentType: resp.Headers.Get("Content-Type"),
	})
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
			if item.Enabled && item.Key != "" {
				items = append(items, parser.FormDataParam{Key: item.Key, Value: item.Value, Type: "text"})
			}
		}
		pr.Body = &parser.Body{Mode: parser.BodyModeFormData, FormData: items}
	case "urlencoded":
		var items []parser.URLEncodedParam
		for _, item := range req.BodyUrlencoded {
			if item.Enabled && item.Key != "" {
				items = append(items, parser.URLEncodedParam{Key: item.Key, Value: item.Value})
			}
		}
		pr.Body = &parser.Body{Mode: parser.BodyModeURLEncoded, URLEncoded: items}
	}

	return pr
}

func rawLang(contentType string) string {
	switch contentType {
	case "JSON":
		return "json"
	case "XML":
		return "xml"
	case "HTML":
		return "html"
	case "JavaScript":
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

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
