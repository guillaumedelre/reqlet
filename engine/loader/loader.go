// Package loader is the single entry point for loading Postman artefacts.
// It auto-detects the collection format (v1.0, v2.0, v2.1), parses it, and
// migrates it to the v2.1 internal model used by the engine.
package loader

import (
	"bytes"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"strings"

	"github.com/guillaumedelre/reqlet/engine/migration"
	"github.com/guillaumedelre/reqlet/engine/parser"
)

// LoadCollection reads a Postman collection from r, auto-detects its format
// (v1.0, v2.0 or v2.1), and always returns a v2.1 Collection.
func LoadCollection(r io.Reader) (*parser.Collection, error) {
	data, err := io.ReadAll(r)
	if err != nil {
		return nil, fmt.Errorf("load collection: %w", err)
	}

	version, err := parser.DetectVersion(data)
	if err != nil {
		return nil, err
	}

	switch version {
	case parser.VersionV21:
		return parser.ParseCollection(bytes.NewReader(data))
	case parser.VersionV20:
		col, err := parser.ParseCollectionV20(bytes.NewReader(data))
		if err != nil {
			return nil, err
		}
		return migration.V20ToV21(col)
	case parser.VersionV10:
		col, err := parser.ParseCollectionV10(bytes.NewReader(data))
		if err != nil {
			return nil, err
		}
		return migration.V10ToV21(col)
	default:
		return nil, fmt.Errorf("loader: unsupported version %q", version)
	}
}

// LoadEnvironment reads a Postman environment from r.
func LoadEnvironment(r io.Reader) (*parser.Environment, error) {
	return parser.ParseEnvironment(r)
}

// LoadData reads a data file from r. ext must be ".csv" or ".json" (case-insensitive).
// Returns a slice of rows, each row as a map of column/key to string value.
func LoadData(r io.Reader, ext string) ([]map[string]string, error) {
	switch strings.ToLower(ext) {
	case ".csv":
		return loadCSV(r)
	case ".json":
		return loadJSONData(r)
	default:
		return nil, fmt.Errorf("data: unsupported extension %q (use .csv or .json)", ext)
	}
}

func loadCSV(r io.Reader) ([]map[string]string, error) {
	cr := csv.NewReader(r)
	cr.FieldsPerRecord = -1 // allow rows with fewer columns than the header
	records, err := cr.ReadAll()
	if err != nil {
		return nil, fmt.Errorf("parse CSV: %w", err)
	}
	if len(records) < 2 {
		return nil, nil
	}
	headers := records[0]
	rows := make([]map[string]string, 0, len(records)-1)
	for _, record := range records[1:] {
		row := make(map[string]string, len(headers))
		for i, h := range headers {
			if i < len(record) {
				row[h] = record[i]
			}
		}
		rows = append(rows, row)
	}
	return rows, nil
}

func loadJSONData(r io.Reader) ([]map[string]string, error) {
	var raw []map[string]interface{}
	if err := json.NewDecoder(r).Decode(&raw); err != nil {
		return nil, fmt.Errorf("parse JSON data: %w", err)
	}
	rows := make([]map[string]string, len(raw))
	for i, obj := range raw {
		row := make(map[string]string, len(obj))
		for k, v := range obj {
			row[k] = fmt.Sprintf("%v", v)
		}
		rows[i] = row
	}
	return rows, nil
}
