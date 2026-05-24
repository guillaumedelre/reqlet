package parser

import (
	"bytes"
	"embed"
	"fmt"

	"github.com/santhosh-tekuri/jsonschema/v6"
)

//go:embed schemas/collection_v21.json schemas/collection_v20.json
var schemasFS embed.FS

// Compiled schemas are initialised once at package load time.
// Failures here mean the embedded files are corrupt — panic is appropriate.
var (
	compiledV21 = mustCompileSchema("schemas/collection_v21.json", SchemaV21)
	compiledV20 = mustCompileSchema("schemas/collection_v20.json", SchemaV20)
)

func mustCompileSchema(path, resourceURL string) *jsonschema.Schema {
	sch, err := compileEmbeddedSchema(path, resourceURL)
	if err != nil {
		panic(fmt.Sprintf("parser: compile embedded schema %q: %v", path, err))
	}
	return sch
}

func compileEmbeddedSchema(path, resourceURL string) (*jsonschema.Schema, error) {
	f, err := schemasFS.Open(path)
	if err != nil {
		return nil, fmt.Errorf("open %q: %w", path, err)
	}
	defer func() { _ = f.Close() }()

	doc, err := jsonschema.UnmarshalJSON(f)
	if err != nil {
		return nil, fmt.Errorf("parse %q: %w", path, err)
	}

	c := jsonschema.NewCompiler()
	if err := c.AddResource(resourceURL, doc); err != nil {
		return nil, fmt.Errorf("register %q: %w", resourceURL, err)
	}

	sch, err := c.Compile(resourceURL)
	if err != nil {
		return nil, fmt.Errorf("compile %q: %w", resourceURL, err)
	}
	return sch, nil
}

// validateAgainstSchema validates raw JSON data against a pre-compiled schema.
func validateAgainstSchema(data []byte, sch *jsonschema.Schema) error {
	inst, err := jsonschema.UnmarshalJSON(bytes.NewReader(data))
	if err != nil {
		return fmt.Errorf("unmarshal for validation: %w", err)
	}
	if err := sch.Validate(inst); err != nil {
		return fmt.Errorf("schema validation: %w", err)
	}
	return nil
}
