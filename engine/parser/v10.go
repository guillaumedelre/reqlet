package parser

import (
	"encoding/json"
	"fmt"
	"io"
)

// CollectionV10 represents a Postman Collection in v1.0 format.
// Unlike v2.x, it uses a flat request list with folder IDs and explicit ordering arrays.
type CollectionV10 struct {
	ID          string       `json:"id"`
	Name        string       `json:"name"`
	Description string       `json:"description,omitempty"`
	Order       []string     `json:"order"`
	Folders     []FolderV10  `json:"folders"`
	Requests    []RequestV10 `json:"requests"`
	Variables   []Variable   `json:"variables,omitempty"`
}

// FolderV10 is a folder in a v1.0 collection.
type FolderV10 struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Description string   `json:"description,omitempty"`
	Order       []string `json:"order"`
}

// RequestV10 is a request in a v1.0 collection (always stored flat, references folder by ID).
type RequestV10 struct {
	ID               string        `json:"id"`
	Name             string        `json:"name"`
	URL              string        `json:"url"`
	Method           string        `json:"method"`
	Headers          string        `json:"headers"`
	DataMode         string        `json:"dataMode,omitempty"`
	Body             string        `json:"body,omitempty"`
	Data             []FormDataV10 `json:"data,omitempty"`
	Description      string        `json:"description,omitempty"`
	Folder           *string       `json:"folder,omitempty"`
	PreRequestScript string        `json:"preRequestScript,omitempty"`
	Tests            string        `json:"tests,omitempty"`
}

// FormDataV10 is a form data or urlencoded parameter in a v1.0 request.
type FormDataV10 struct {
	Key     string `json:"key"`
	Value   string `json:"value"`
	Enabled bool   `json:"enabled"`
	Type    string `json:"type,omitempty"`
}

// ParseCollectionV10 reads a Postman Collection v1.0 from r.
func ParseCollectionV10(r io.Reader) (*CollectionV10, error) {
	data, err := io.ReadAll(r)
	if err != nil {
		return nil, fmt.Errorf("read collection: %w", err)
	}

	var c CollectionV10
	if err := json.Unmarshal(data, &c); err != nil {
		return nil, fmt.Errorf("parse collection v1.0: %w", err)
	}

	if c.Name == "" {
		return nil, fmt.Errorf("collection: missing name")
	}

	return &c, nil
}
