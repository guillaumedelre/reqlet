package parser

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"strings"
)

const (
	schemaV21 = "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
	schemaV20 = "https://schema.getpostman.com/json/collection/v2.0.0/collection.json"
)

// ParseCollection reads a Postman Collection v2.1 from r.
func ParseCollection(r io.Reader) (*Collection, error) {
	data, err := io.ReadAll(r)
	if err != nil {
		return nil, fmt.Errorf("read collection: %w", err)
	}

	var c Collection
	if err := json.Unmarshal(data, &c); err != nil {
		return nil, fmt.Errorf("parse collection: %w", err)
	}

	if err := validateCollection(&c); err != nil {
		return nil, err
	}

	return &c, nil
}

// ParseCollectionFile reads a Postman Collection from a file path.
func ParseCollectionFile(path string) (*Collection, error) {
	f, err := os.Open(path) //nolint:gosec // intentional: caller-provided path
	if err != nil {
		return nil, fmt.Errorf("open collection %q: %w", path, err)
	}
	defer func() { _ = f.Close() }()
	return ParseCollection(f)
}

// ParseEnvironment reads a Postman Environment from r.
func ParseEnvironment(r io.Reader) (*Environment, error) {
	data, err := io.ReadAll(r)
	if err != nil {
		return nil, fmt.Errorf("read environment: %w", err)
	}

	var e Environment
	if err := json.Unmarshal(data, &e); err != nil {
		return nil, fmt.Errorf("parse environment: %w", err)
	}

	if err := validateEnvironment(&e); err != nil {
		return nil, err
	}

	return &e, nil
}

// ParseEnvironmentFile reads a Postman Environment from a file path.
func ParseEnvironmentFile(path string) (*Environment, error) {
	f, err := os.Open(path) //nolint:gosec // intentional: caller-provided path
	if err != nil {
		return nil, fmt.Errorf("open environment %q: %w", path, err)
	}
	defer func() { _ = f.Close() }()
	return ParseEnvironment(f)
}

// validateCollection checks that the collection has the required fields.
func validateCollection(c *Collection) error {
	if c.Info.Name == "" {
		return fmt.Errorf("collection: missing info.name")
	}
	if !isSupportedSchema(c.Info.Schema) {
		return fmt.Errorf("collection: unsupported schema %q", c.Info.Schema)
	}
	return nil
}

// validateEnvironment checks that the environment has the required fields.
func validateEnvironment(e *Environment) error {
	if e.Name == "" {
		return fmt.Errorf("environment: missing name")
	}
	return nil
}

func isSupportedSchema(schema string) bool {
	return strings.HasPrefix(schema, schemaV21) ||
		strings.HasPrefix(schema, schemaV20)
}

// Walk calls fn for every leaf request item in the collection, in depth-first
// order. fn receives the full ancestor folder chain.
func Walk(c *Collection, fn func(folders []Item, req Item)) {
	walkItems(c.Item, nil, fn)
}

func walkItems(items []Item, ancestors []Item, fn func(folders []Item, req Item)) {
	for _, item := range items {
		if item.IsFolder() {
			walkItems(item.Item, append(ancestors, item), fn)
		} else {
			fn(ancestors, item)
		}
	}
}

// ScriptBody joins the exec lines of a script into a single string.
func ScriptBody(s Script) string {
	return strings.Join(s.Exec, "\n")
}
