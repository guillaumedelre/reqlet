package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewJSONStore_CreatesDir(t *testing.T) {
	dir := filepath.Join(t.TempDir(), "sub", "store")
	_, err := newJSONStore(dir)
	require.NoError(t, err)
	_, err = os.Stat(dir)
	assert.NoError(t, err)
}

func TestJSONStore_SaveAndGet(t *testing.T) {
	dir := t.TempDir()
	store, err := newJSONStore(dir)
	require.NoError(t, err)

	payload := json.RawMessage(`{"id":"abc","name":"test"}`)
	require.NoError(t, store.save("abc", payload))

	got, err := store.get("abc")
	require.NoError(t, err)
	assert.JSONEq(t, string(payload), string(got))
}

func TestJSONStore_Get_NotFound(t *testing.T) {
	dir := t.TempDir()
	store, err := newJSONStore(dir)
	require.NoError(t, err)

	_, err = store.get("missing")
	assert.ErrorIs(t, err, errNotFound)
}

func TestJSONStore_List_Empty(t *testing.T) {
	dir := t.TempDir()
	store, err := newJSONStore(dir)
	require.NoError(t, err)

	items, err := store.list()
	require.NoError(t, err)
	assert.Nil(t, items)
}

func TestJSONStore_List_Items(t *testing.T) {
	dir := t.TempDir()
	store, err := newJSONStore(dir)
	require.NoError(t, err)

	require.NoError(t, store.save("a", json.RawMessage(`{"id":"a"}`)))
	require.NoError(t, store.save("b", json.RawMessage(`{"id":"b"}`)))

	items, err := store.list()
	require.NoError(t, err)
	assert.Len(t, items, 2)
}

func TestJSONStore_List_SkipsNonJSON(t *testing.T) {
	dir := t.TempDir()
	store, err := newJSONStore(dir)
	require.NoError(t, err)

	require.NoError(t, store.save("a", json.RawMessage(`{"id":"a"}`)))
	// Write a non-JSON file directly
	require.NoError(t, os.WriteFile(filepath.Join(dir, "readme.txt"), []byte("ignore me"), 0o600))

	items, err := store.list()
	require.NoError(t, err)
	assert.Len(t, items, 1)
}

func TestJSONStore_Delete(t *testing.T) {
	dir := t.TempDir()
	store, err := newJSONStore(dir)
	require.NoError(t, err)

	require.NoError(t, store.save("del", json.RawMessage(`{"id":"del"}`)))
	require.NoError(t, store.delete("del"))

	_, err = store.get("del")
	assert.ErrorIs(t, err, errNotFound)
}

func TestJSONStore_Delete_NotFound(t *testing.T) {
	dir := t.TempDir()
	store, err := newJSONStore(dir)
	require.NoError(t, err)

	// Deleting a non-existent entry is not an error.
	assert.NoError(t, store.delete("ghost"))
}

func TestExtractStringField(t *testing.T) {
	raw := json.RawMessage(`{"id":"xyz","count":3}`)

	val, err := extractStringField(raw, "id")
	require.NoError(t, err)
	assert.Equal(t, "xyz", val)
}

func TestExtractStringField_Missing(t *testing.T) {
	raw := json.RawMessage(`{"name":"test"}`)
	_, err := extractStringField(raw, "id")
	assert.Error(t, err)
}

func TestExtractStringField_NotString(t *testing.T) {
	raw := json.RawMessage(`{"id":42}`)
	_, err := extractStringField(raw, "id")
	assert.Error(t, err)
}

func TestExtractStringField_InvalidJSON(t *testing.T) {
	raw := json.RawMessage(`not json`)
	_, err := extractStringField(raw, "id")
	assert.Error(t, err)
}

func TestNewJSONStore_Error(t *testing.T) {
	base := t.TempDir()
	// Put a regular file where a sub-directory is expected so MkdirAll fails.
	require.NoError(t, os.WriteFile(filepath.Join(base, "sub"), []byte("x"), 0o600))
	_, err := newJSONStore(filepath.Join(base, "sub", "store"))
	assert.Error(t, err)
}

func TestJSONStore_List_ReadDirError(t *testing.T) {
	dir := t.TempDir()
	store, err := newJSONStore(dir)
	require.NoError(t, err)

	// Replace the store directory with a regular file so ReadDir fails.
	require.NoError(t, os.RemoveAll(store.dir))
	require.NoError(t, os.WriteFile(store.dir, []byte("not a dir"), 0o600))

	_, err = store.list()
	assert.Error(t, err)
}

func TestJSONStore_List_DirNotExist(t *testing.T) {
	// dir never created — should return nil, nil (os.IsNotExist branch).
	store := &jsonStore{dir: filepath.Join(t.TempDir(), "does-not-exist")}
	items, err := store.list()
	require.NoError(t, err)
	assert.Nil(t, items)
}

func TestJSONStore_Save_MkdirAllError(t *testing.T) {
	base := t.TempDir()
	// Place a regular file where a parent directory is expected.
	require.NoError(t, os.WriteFile(filepath.Join(base, "blocker"), []byte("x"), 0o600))
	store := &jsonStore{dir: filepath.Join(base, "blocker", "store")}

	err := store.save("x", json.RawMessage(`{}`))
	assert.Error(t, err)
}

func TestJSONStore_List_ReadFileError(t *testing.T) {
	dir := t.TempDir()
	store, err := newJSONStore(dir)
	require.NoError(t, err)

	// Create a broken symlink that looks like a .json file to ReadDir.
	linkPath := filepath.Join(dir, "broken.json")
	require.NoError(t, os.Symlink("/nonexistent/target/that/does/not/exist", linkPath))

	_, err = store.list()
	assert.Error(t, err)
}

func TestJSONStore_Get_IsDir(t *testing.T) {
	dir := t.TempDir()
	store, err := newJSONStore(dir)
	require.NoError(t, err)

	// Place a directory at the path ReadFile would target.
	require.NoError(t, os.MkdirAll(store.path("x"), 0o750))

	_, err = store.get("x")
	assert.Error(t, err)
	assert.NotErrorIs(t, err, errNotFound)
}

func TestJSONStore_Save_WriteError(t *testing.T) {
	dir := t.TempDir()
	store, err := newJSONStore(dir)
	require.NoError(t, err)

	// Place a directory at the path WriteFile would target.
	require.NoError(t, os.MkdirAll(store.path("x"), 0o750))

	err = store.save("x", json.RawMessage(`{}`))
	assert.Error(t, err)
}

func TestJSONStore_Delete_Error(t *testing.T) {
	dir := t.TempDir()
	store, err := newJSONStore(dir)
	require.NoError(t, err)

	// Place a non-empty directory at the path Remove would target.
	require.NoError(t, os.MkdirAll(filepath.Join(store.path("x"), "sub"), 0o750))

	err = store.delete("x")
	assert.Error(t, err)
}

func TestWorkspacePath_EnvVar(t *testing.T) {
	t.Setenv("REQLET_WORKSPACE_PATH", "/tmp/custom")
	p, err := workspacePath()
	require.NoError(t, err)
	assert.Equal(t, "/tmp/custom", p)
}

func TestWorkspacePath_Default(t *testing.T) {
	t.Setenv("REQLET_WORKSPACE_PATH", "")
	p, err := workspacePath()
	require.NoError(t, err)
	assert.Contains(t, p, ".reqlet")
	assert.Contains(t, p, "workspace")
}

func TestWorkspacePath_HomeDirError(t *testing.T) {
	t.Setenv("REQLET_WORKSPACE_PATH", "")
	// os.UserHomeDir consults $HOME on Linux; clearing it triggers an error.
	t.Setenv("HOME", "")
	_, err := workspacePath()
	require.Error(t, err)
	assert.Contains(t, err.Error(), "resolve home dir")
}
