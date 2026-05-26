// Package workspace manages content data (collections and environments) as JSON
// files on disk. The storage path is provided by the caller — this package
// never resolves OS-specific defaults.
package workspace

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"

	"github.com/guillaumedelre/reqlet/engine/parser"
)

// Workspace manages collections and environments stored as JSON files under
// basePath/collections/ and basePath/environments/.
type Workspace struct {
	basePath string
}

// New initialises a Workspace rooted at basePath, creating the required
// subdirectories if they do not exist. It is safe to call multiple times.
func New(basePath string) (*Workspace, error) {
	for _, sub := range []string{"collections", "environments"} {
		if err := os.MkdirAll(filepath.Join(basePath, sub), 0o750); err != nil {
			return nil, fmt.Errorf("workspace: create %s dir: %w", sub, err)
		}
	}
	return &Workspace{basePath: basePath}, nil
}

// LoadCollections reads all JSON files from the collections directory and
// returns the parsed collections. Files that cannot be decoded are skipped
// with an error aggregated in the returned error.
func (w *Workspace) LoadCollections() ([]*parser.Collection, error) {
	return loadAll(filepath.Join(w.basePath, "collections"), func() *parser.Collection {
		return &parser.Collection{}
	})
}

// SaveCollection writes c to collections/<id>.json in Postman v2.1 format.
// c.Info.PostmanID must be non-empty.
func (w *Workspace) SaveCollection(c *parser.Collection) error {
	if c.Info.PostmanID == "" {
		return errors.New("workspace: collection has no PostmanID")
	}
	return saveJSON(filepath.Join(w.basePath, "collections", c.Info.PostmanID+".json"), c)
}

// DeleteCollection removes the JSON file for the given collection ID.
func (w *Workspace) DeleteCollection(id string) error {
	return deleteFile(filepath.Join(w.basePath, "collections", id+".json"))
}

// LoadEnvironments reads all JSON files from the environments directory.
func (w *Workspace) LoadEnvironments() ([]*parser.Environment, error) {
	return loadAll(filepath.Join(w.basePath, "environments"), func() *parser.Environment {
		return &parser.Environment{}
	})
}

// SaveEnvironment writes e to environments/<id>.json.
// e.ID must be non-empty.
func (w *Workspace) SaveEnvironment(e *parser.Environment) error {
	if e.ID == "" {
		return errors.New("workspace: environment has no ID")
	}
	return saveJSON(filepath.Join(w.basePath, "environments", e.ID+".json"), e)
}

// DeleteEnvironment removes the JSON file for the given environment ID.
func (w *Workspace) DeleteEnvironment(id string) error {
	return deleteFile(filepath.Join(w.basePath, "environments", id+".json"))
}

// loadAll reads every *.json file in dir, decodes each into a T via newT(),
// and returns the slice. Decode errors are collected and returned as a single
// joined error alongside any successfully loaded items.
func loadAll[T any](dir string, newT func() *T) ([]*T, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, fmt.Errorf("workspace: read dir %s: %w", dir, err)
	}

	var (
		items []*T
		errs  []error
	)
	for _, e := range entries {
		if e.IsDir() || filepath.Ext(e.Name()) != ".json" {
			continue
		}
		path := filepath.Join(dir, e.Name())
		f, err := os.Open(path) //nolint:gosec // path is dir + filename from ReadDir, not user input
		if err != nil {
			errs = append(errs, fmt.Errorf("%s: %w", e.Name(), err))
			continue
		}
		item := newT()
		decodeErr := json.NewDecoder(f).Decode(item)
		_ = f.Close() //nolint:errcheck // close of read-only file; error is irrelevant
		if decodeErr != nil {
			errs = append(errs, fmt.Errorf("%s: %w", e.Name(), decodeErr))
			continue
		}
		items = append(items, item)
	}
	return items, errors.Join(errs...)
}

func saveJSON(path string, v any) error {
	f, err := os.Create(path) //nolint:gosec // path is basePath + fixed subdir + ID.json, not user input
	if err != nil {
		return fmt.Errorf("workspace: create %s: %w", path, err)
	}
	defer func() { _ = f.Close() }() //nolint:errcheck // write already flushed via Encode
	enc := json.NewEncoder(f)
	enc.SetIndent("", "  ")
	if err := enc.Encode(v); err != nil {
		return fmt.Errorf("workspace: encode %s: %w", path, err)
	}
	return nil
}

func deleteFile(path string) error {
	if err := os.Remove(path); err != nil && !errors.Is(err, os.ErrNotExist) {
		return fmt.Errorf("workspace: delete %s: %w", path, err)
	}
	return nil
}
