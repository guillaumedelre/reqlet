package storage

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newTestStorage(t *testing.T) *Storage {
	t.Helper()
	// Unique DSN per test to avoid cross-test interference on shared cache.
	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", t.Name())
	s, err := New(dsn)
	require.NoError(t, err)
	t.Cleanup(func() { _ = s.Close() })
	return s
}

// --- HistoryStore ---

func TestHistory_InsertAndGet(t *testing.T) {
	s := newTestStorage(t)
	ctx := context.Background()

	entry := HistoryEntry{
		ID:         "h-1",
		Timestamp:  time.UnixMilli(1_000_000),
		Request:    json.RawMessage(`{"method":"GET","url":"https://example.com"}`),
		Response:   json.RawMessage(`{"status":200}`),
		DurationMs: 42,
	}
	require.NoError(t, s.History.Insert(ctx, entry))

	got, err := s.History.Get(ctx, "h-1")
	require.NoError(t, err)
	assert.Equal(t, entry.ID, got.ID)
	assert.Equal(t, entry.DurationMs, got.DurationMs)
	assert.Equal(t, entry.Timestamp.UnixMilli(), got.Timestamp.UnixMilli())
	assert.JSONEq(t, string(entry.Request), string(got.Request))
	assert.JSONEq(t, string(entry.Response), string(got.Response))
}

func TestHistory_List_OrderByTimestampDesc(t *testing.T) {
	s := newTestStorage(t)
	ctx := context.Background()

	for i := range 3 {
		require.NoError(t, s.History.Insert(ctx, HistoryEntry{
			ID:        fmt.Sprintf("h-%d", i),
			Timestamp: time.UnixMilli(int64(i * 1000)),
			Request:   json.RawMessage(`{}`),
			Response:  json.RawMessage(`{}`),
		}))
	}

	entries, err := s.History.List(ctx, 10, 0)
	require.NoError(t, err)
	require.Len(t, entries, 3)
	assert.Equal(t, "h-2", entries[0].ID, "most recent first")
	assert.Equal(t, "h-0", entries[2].ID)
}

func TestHistory_List_Pagination(t *testing.T) {
	s := newTestStorage(t)
	ctx := context.Background()

	for i := range 5 {
		require.NoError(t, s.History.Insert(ctx, HistoryEntry{
			ID:       fmt.Sprintf("h-%d", i),
			Request:  json.RawMessage(`{}`),
			Response: json.RawMessage(`{}`),
		}))
	}

	page, err := s.History.List(ctx, 2, 0)
	require.NoError(t, err)
	assert.Len(t, page, 2)

	page2, err := s.History.List(ctx, 2, 2)
	require.NoError(t, err)
	assert.Len(t, page2, 2)

	assert.NotEqual(t, page[0].ID, page2[0].ID)
}

func TestHistory_Delete(t *testing.T) {
	s := newTestStorage(t)
	ctx := context.Background()

	require.NoError(t, s.History.Insert(ctx, HistoryEntry{
		ID: "del-me", Request: json.RawMessage(`{}`), Response: json.RawMessage(`{}`),
	}))
	require.NoError(t, s.History.Delete(ctx, "del-me"))

	_, err := s.History.Get(ctx, "del-me")
	require.Error(t, err)
}

func TestHistory_Clear(t *testing.T) {
	s := newTestStorage(t)
	ctx := context.Background()

	for i := range 3 {
		require.NoError(t, s.History.Insert(ctx, HistoryEntry{
			ID: fmt.Sprintf("c-%d", i), Request: json.RawMessage(`{}`), Response: json.RawMessage(`{}`),
		}))
	}
	require.NoError(t, s.History.Clear(ctx))

	entries, err := s.History.List(ctx, 100, 0)
	require.NoError(t, err)
	assert.Empty(t, entries)
}

// --- SettingsStore ---

func TestSettings_SetAndGet(t *testing.T) {
	s := newTestStorage(t)
	ctx := context.Background()

	require.NoError(t, s.Settings.Set(ctx, "theme", "dark"))

	val, err := s.Settings.Get(ctx, "theme")
	require.NoError(t, err)
	assert.Equal(t, "dark", val)
}

func TestSettings_Upsert(t *testing.T) {
	s := newTestStorage(t)
	ctx := context.Background()

	require.NoError(t, s.Settings.Set(ctx, "theme", "dark"))
	require.NoError(t, s.Settings.Set(ctx, "theme", "light"))

	val, err := s.Settings.Get(ctx, "theme")
	require.NoError(t, err)
	assert.Equal(t, "light", val)
}

func TestSettings_Get_NotFound(t *testing.T) {
	s := newTestStorage(t)
	ctx := context.Background()

	_, err := s.Settings.Get(ctx, "nonexistent")
	require.Error(t, err)
}

func TestSettings_List(t *testing.T) {
	s := newTestStorage(t)
	ctx := context.Background()

	require.NoError(t, s.Settings.Set(ctx, "a", "1"))
	require.NoError(t, s.Settings.Set(ctx, "b", "2"))

	all, err := s.Settings.List(ctx)
	require.NoError(t, err)
	assert.Equal(t, map[string]string{"a": "1", "b": "2"}, all)
}

// --- New error paths ---

func TestNew_InvalidPath_ReturnsError(t *testing.T) {
	// Directory does not exist — modernc.org/sqlite cannot create the file.
	_, err := New("file:/nonexistent/dir/reqlet.db?cache=shared")
	require.Error(t, err)
}

func TestNew_DirtyMigration_ReturnsError(t *testing.T) {
	// Pre-seed a schema_migrations table with a dirty flag so that
	// golang-migrate returns ErrDirty on Up(), exercising the runMigrations
	// error path inside New.
	// The anchor connection must stay open: closing it destroys the in-memory DB.
	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", t.Name())
	anchor, err := sql.Open("sqlite", dsn)
	require.NoError(t, err)
	defer func() { _ = anchor.Close() }()

	_, err = anchor.Exec(`CREATE TABLE schema_migrations (version bigint NOT NULL PRIMARY KEY, dirty bool NOT NULL)`)
	require.NoError(t, err)
	_, err = anchor.Exec(`INSERT INTO schema_migrations VALUES (1, 1)`) // dirty = true
	require.NoError(t, err)

	_, err = New(dsn)
	require.Error(t, err)
}

// --- Error paths on closed DB ---

func TestHistory_List_DBClosed_ReturnsError(t *testing.T) {
	s := newTestStorage(t)
	ctx := context.Background()
	require.NoError(t, s.Close())
	_, err := s.History.List(ctx, 10, 0)
	require.Error(t, err)
}

func TestSettings_List_DBClosed_ReturnsError(t *testing.T) {
	s := newTestStorage(t)
	ctx := context.Background()
	require.NoError(t, s.Close())
	_, err := s.Settings.List(ctx)
	require.Error(t, err)
}

// --- Migrations are idempotent ---

func TestNew_MigrationsIdempotent(t *testing.T) {
	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", t.Name())
	s1, err := New(dsn)
	require.NoError(t, err)
	defer func() { _ = s1.Close() }()

	s2, err := New(dsn)
	require.NoError(t, err)
	defer func() { _ = s2.Close() }()
}
