package workspace

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/guillaumedelre/reqlet/engine/parser"
)

func newTestWorkspace(t *testing.T) *Workspace {
	t.Helper()
	w, err := New(t.TempDir())
	require.NoError(t, err)
	return w
}

// --- New ---

func TestNew_BasePathIsFile_ReturnsError(t *testing.T) {
	base := t.TempDir()
	// Put a regular file where the workspace root should be.
	conflict := filepath.Join(base, "conflict")
	require.NoError(t, os.WriteFile(conflict, []byte("x"), 0o600))
	// MkdirAll(<file>/collections) must fail.
	_, err := New(conflict)
	require.Error(t, err)
}

func TestNew_CreatesDirectories(t *testing.T) {
	base := t.TempDir()
	_, err := New(base)
	require.NoError(t, err)
	assert.DirExists(t, filepath.Join(base, "collections"))
	assert.DirExists(t, filepath.Join(base, "environments"))
}

func TestNew_Idempotent(t *testing.T) {
	base := t.TempDir()
	_, err := New(base)
	require.NoError(t, err)
	_, err = New(base)
	require.NoError(t, err)
}

// --- Collections ---

func TestSaveAndLoadCollection(t *testing.T) {
	w := newTestWorkspace(t)
	c := &parser.Collection{Info: parser.Info{PostmanID: "abc-123", Name: "My API"}}

	require.NoError(t, w.SaveCollection(c))

	cols, err := w.LoadCollections()
	require.NoError(t, err)
	require.Len(t, cols, 1)
	assert.Equal(t, "abc-123", cols[0].Info.PostmanID)
	assert.Equal(t, "My API", cols[0].Info.Name)
}

func TestSaveCollection_NoID_ReturnsError(t *testing.T) {
	w := newTestWorkspace(t)
	err := w.SaveCollection(&parser.Collection{})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "no PostmanID")
}

func TestLoadCollections_Empty(t *testing.T) {
	w := newTestWorkspace(t)
	cols, err := w.LoadCollections()
	require.NoError(t, err)
	assert.Empty(t, cols)
}

func TestLoadCollections_BrokenSymlink_ReturnsError(t *testing.T) {
	w := newTestWorkspace(t)
	link := filepath.Join(w.basePath, "collections", "broken.json")
	require.NoError(t, os.Symlink("/nonexistent/target.json", link))

	cols, err := w.LoadCollections()
	assert.Error(t, err, "broken symlink should aggregate an open error")
	assert.Empty(t, cols)
}

func TestLoadCollections_SkipsInvalidJSON(t *testing.T) {
	w := newTestWorkspace(t)
	require.NoError(t, w.SaveCollection(&parser.Collection{Info: parser.Info{PostmanID: "good"}}))

	// write a broken JSON file directly
	broken := filepath.Join(w.basePath, "collections", "bad.json")
	require.NoError(t, writeFile(broken, []byte("not json")))

	cols, err := w.LoadCollections()
	assert.Error(t, err)
	assert.Len(t, cols, 1, "valid collection should still be returned")
}

func TestDeleteCollection(t *testing.T) {
	w := newTestWorkspace(t)
	c := &parser.Collection{Info: parser.Info{PostmanID: "del-me"}}
	require.NoError(t, w.SaveCollection(c))

	require.NoError(t, w.DeleteCollection("del-me"))

	cols, err := w.LoadCollections()
	require.NoError(t, err)
	assert.Empty(t, cols)
}

func TestDeleteCollection_NotExist_NoError(t *testing.T) {
	w := newTestWorkspace(t)
	require.NoError(t, w.DeleteCollection("ghost"))
}

func TestDeleteCollection_IsNonEmptyDir_ReturnsError(t *testing.T) {
	w := newTestWorkspace(t)
	// Create a non-empty directory named "dir.json" — os.Remove cannot remove it.
	nested := filepath.Join(w.basePath, "collections", "dir.json", "sub")
	require.NoError(t, os.MkdirAll(nested, 0o750))
	err := w.DeleteCollection("dir")
	require.Error(t, err)
}

func TestSaveCollection_WriteDirGone_ReturnsError(t *testing.T) {
	w := newTestWorkspace(t)
	require.NoError(t, os.RemoveAll(filepath.Join(w.basePath, "collections")))
	err := w.SaveCollection(&parser.Collection{Info: parser.Info{PostmanID: "x"}})
	require.Error(t, err)
}

func TestSaveEnvironment_WriteDirGone_ReturnsError(t *testing.T) {
	w := newTestWorkspace(t)
	require.NoError(t, os.RemoveAll(filepath.Join(w.basePath, "environments")))
	err := w.SaveEnvironment(&parser.Environment{ID: "x"})
	require.Error(t, err)
}

// --- Environments ---

func TestSaveAndLoadEnvironment(t *testing.T) {
	w := newTestWorkspace(t)
	e := &parser.Environment{
		ID:   "env-1",
		Name: "Production",
		Values: []parser.EnvironmentValue{
			{Key: "base_url", Value: "https://api.example.com", Enabled: true},
		},
	}

	require.NoError(t, w.SaveEnvironment(e))

	envs, err := w.LoadEnvironments()
	require.NoError(t, err)
	require.Len(t, envs, 1)
	assert.Equal(t, "env-1", envs[0].ID)
	assert.Equal(t, "Production", envs[0].Name)
	require.Len(t, envs[0].Values, 1)
	assert.Equal(t, "base_url", envs[0].Values[0].Key)
}

func TestSaveEnvironment_NoID_ReturnsError(t *testing.T) {
	w := newTestWorkspace(t)
	err := w.SaveEnvironment(&parser.Environment{Name: "oops"})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "no ID")
}

func TestLoadEnvironments_Empty(t *testing.T) {
	w := newTestWorkspace(t)
	envs, err := w.LoadEnvironments()
	require.NoError(t, err)
	assert.Empty(t, envs)
}

func TestDeleteEnvironment(t *testing.T) {
	w := newTestWorkspace(t)
	e := &parser.Environment{ID: "rm-env"}
	require.NoError(t, w.SaveEnvironment(e))

	require.NoError(t, w.DeleteEnvironment("rm-env"))

	envs, err := w.LoadEnvironments()
	require.NoError(t, err)
	assert.Empty(t, envs)
}

func TestDeleteEnvironment_NotExist_NoError(t *testing.T) {
	w := newTestWorkspace(t)
	require.NoError(t, w.DeleteEnvironment("ghost"))
}

// TestLoadCollections_ReadDirFails covers the os.ReadDir error branch in loadAll:
// the collections directory itself has been removed after workspace creation.
func TestLoadCollections_ReadDirFails(t *testing.T) {
	w := newTestWorkspace(t)
	// Remove the entire collections directory so os.ReadDir returns an error.
	require.NoError(t, os.RemoveAll(filepath.Join(w.basePath, "collections")))
	_, err := w.LoadCollections()
	require.Error(t, err)
	assert.Contains(t, err.Error(), "read dir")
}

// TestLoadCollections_SubdirSkipped verifies that subdirectories inside the
// collections folder are silently skipped (e.IsDir() == true branch).
func TestLoadCollections_SubdirSkipped(t *testing.T) {
	w := newTestWorkspace(t)
	// Create a real subdirectory inside collections/.
	require.NoError(t, os.Mkdir(filepath.Join(w.basePath, "collections", "subdir"), 0o750))
	// Also add a valid collection so we can verify normal items still load.
	require.NoError(t, w.SaveCollection(&parser.Collection{Info: parser.Info{PostmanID: "c1"}}))

	cols, err := w.LoadCollections()
	require.NoError(t, err)
	require.Len(t, cols, 1, "subdir must be skipped; only valid collection must be returned")
}

// TestSaveJSON_EncodeError covers the json.Encoder.Encode failure branch in
// saveJSON: by providing a value that cannot be JSON-marshalled (a channel),
// json.Marshal will return an error, triggering the error path at line 120.
func TestSaveJSON_EncodeError(t *testing.T) {
	path := filepath.Join(t.TempDir(), "out.json")
	// A channel cannot be JSON-encoded; Encode will return a *json.UnsupportedTypeError.
	err := saveJSON(path, make(chan int))
	require.Error(t, err)
	assert.Contains(t, err.Error(), "workspace: encode")
}

// --- helpers ---

func writeFile(path string, data []byte) error {
	return os.WriteFile(path, data, 0o600)
}
