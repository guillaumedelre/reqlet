package migration

import (
	"fmt"
	"strings"

	"github.com/guillaumedelre/reqlet/engine/parser"
)

// V10ToV21 converts a v1.0 collection to the v2.1 internal model.
// v1.0 stores all requests in a flat list and uses ID references for folder membership.
// This function rebuilds the nested item tree expected by the engine.
func V10ToV21(c *parser.CollectionV10) (*parser.Collection, error) {
	byID := make(map[string]*parser.RequestV10, len(c.Requests))
	for i := range c.Requests {
		byID[c.Requests[i].ID] = &c.Requests[i]
	}

	// Top-level requests (order array lists IDs without a folder).
	var items []parser.Item
	for _, id := range c.Order {
		req, ok := byID[id]
		if !ok {
			continue
		}
		item, err := convertRequestV10(req)
		if err != nil {
			return nil, fmt.Errorf("request %q: %w", req.Name, err)
		}
		items = append(items, item)
	}

	// Folder items.
	for _, folder := range c.Folders {
		folderItem := parser.Item{
			Name:        folder.Name,
			Description: folder.Description,
		}
		for _, id := range folder.Order {
			req, ok := byID[id]
			if !ok {
				continue
			}
			item, err := convertRequestV10(req)
			if err != nil {
				return nil, fmt.Errorf("folder %q request %q: %w", folder.Name, req.Name, err)
			}
			folderItem.Item = append(folderItem.Item, item)
		}
		items = append(items, folderItem)
	}

	variables := make([]parser.Variable, len(c.Variables))
	copy(variables, c.Variables)

	return &parser.Collection{
		Info: parser.Info{
			PostmanID:   c.ID,
			Name:        c.Name,
			Description: c.Description,
			Schema:      parser.SchemaV21,
		},
		Item:     items,
		Variable: variables,
	}, nil
}

func convertRequestV10(r *parser.RequestV10) (parser.Item, error) {
	headers := parseHeadersV10(r.Headers)
	body := convertBodyV10(r)
	events := convertScriptsV10(r.PreRequestScript, r.Tests)

	return parser.Item{
		Name:        r.Name,
		Description: r.Description,
		Event:       events,
		Request: &parser.Request{
			Method:      strings.ToUpper(r.Method),
			URL:         parser.URL{Raw: r.URL},
			Header:      headers,
			Body:        body,
			Description: r.Description,
		},
	}, nil
}

// parseHeadersV10 parses the v1.0 header string "Key: Value\nKey2: Value2\n".
func parseHeadersV10(raw string) []parser.Header {
	if raw == "" {
		return nil
	}
	var headers []parser.Header
	for _, line := range strings.Split(raw, "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		k, v, ok := strings.Cut(line, ":")
		if !ok {
			continue
		}
		headers = append(headers, parser.Header{
			Key:   strings.TrimSpace(k),
			Value: strings.TrimSpace(v),
		})
	}
	return headers
}

// convertBodyV10 converts the v1.0 body fields to a v2.1 Body.
func convertBodyV10(r *parser.RequestV10) *parser.Body {
	switch r.DataMode {
	case "urlencoded":
		params := make([]parser.URLEncodedParam, 0, len(r.Data))
		for _, d := range r.Data {
			params = append(params, parser.URLEncodedParam{Key: d.Key, Value: d.Value})
		}
		if len(params) == 0 {
			return nil
		}
		return &parser.Body{Mode: parser.BodyModeURLEncoded, URLEncoded: params}
	case "params":
		params := make([]parser.FormDataParam, 0, len(r.Data))
		for _, d := range r.Data {
			params = append(params, parser.FormDataParam{Key: d.Key, Value: d.Value, Type: d.Type})
		}
		if len(params) == 0 {
			return nil
		}
		return &parser.Body{Mode: parser.BodyModeFormData, FormData: params}
	default:
		if r.Body != "" {
			return &parser.Body{Mode: parser.BodyModeRaw, Raw: r.Body}
		}
		return nil
	}
}

// convertScriptsV10 converts v1.0 single-string scripts to v2.1 Events.
func convertScriptsV10(preRequest, tests string) []parser.Event {
	var events []parser.Event
	if preRequest != "" {
		events = append(events, parser.Event{
			Listen: "prerequest",
			Script: parser.Script{
				Type: "text/javascript",
				Exec: strings.Split(preRequest, "\n"),
			},
		})
	}
	if tests != "" {
		events = append(events, parser.Event{
			Listen: "test",
			Script: parser.Script{
				Type: "text/javascript",
				Exec: strings.Split(tests, "\n"),
			},
		})
	}
	return events
}
