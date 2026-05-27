package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
)

var errNotFound = errors.New("not found")

type jsonStore struct {
	dir string
}

func newJSONStore(dir string) (*jsonStore, error) {
	if err := os.MkdirAll(dir, 0o750); err != nil {
		return nil, fmt.Errorf("create store dir %q: %w", dir, err)
	}
	return &jsonStore{dir: dir}, nil
}

func (s *jsonStore) list() ([]json.RawMessage, error) {
	entries, err := os.ReadDir(s.dir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, fmt.Errorf("read dir: %w", err)
	}
	var out []json.RawMessage
	for _, e := range entries {
		if e.IsDir() || filepath.Ext(e.Name()) != ".json" {
			continue
		}
		data, err := os.ReadFile(filepath.Join(s.dir, e.Name())) //nolint:gosec
		if err != nil {
			return nil, fmt.Errorf("read %q: %w", e.Name(), err)
		}
		out = append(out, json.RawMessage(data))
	}
	return out, nil
}

func (s *jsonStore) get(id string) (json.RawMessage, error) {
	data, err := os.ReadFile(s.path(id)) //nolint:gosec
	if err != nil {
		if os.IsNotExist(err) {
			return nil, errNotFound
		}
		return nil, fmt.Errorf("read: %w", err)
	}
	return json.RawMessage(data), nil
}

func (s *jsonStore) save(id string, data json.RawMessage) error {
	if err := os.MkdirAll(s.dir, 0o750); err != nil {
		return fmt.Errorf("create dir: %w", err)
	}
	if err := os.WriteFile(s.path(id), data, 0o640); err != nil { //nolint:gosec
		return fmt.Errorf("write: %w", err)
	}
	return nil
}

func (s *jsonStore) delete(id string) error {
	err := os.Remove(s.path(id))
	if err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("delete: %w", err)
	}
	return nil
}

func (s *jsonStore) path(id string) string {
	return filepath.Join(s.dir, id+".json")
}

// extractStringField extracts a string-valued field from a JSON object.
func extractStringField(data json.RawMessage, field string) (string, error) {
	var obj map[string]json.RawMessage
	if err := json.Unmarshal(data, &obj); err != nil {
		return "", err
	}
	raw, ok := obj[field]
	if !ok {
		return "", fmt.Errorf("field %q not found", field)
	}
	var s string
	if err := json.Unmarshal(raw, &s); err != nil {
		return "", fmt.Errorf("field %q is not a string", field)
	}
	return s, nil
}

// workspacePath returns REQLET_WORKSPACE_PATH or ~/.reqlet/workspace.
func workspacePath() (string, error) {
	if v := os.Getenv("REQLET_WORKSPACE_PATH"); v != "" {
		return v, nil
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("resolve home dir: %w", err)
	}
	return filepath.Join(home, ".reqlet", "workspace"), nil
}
