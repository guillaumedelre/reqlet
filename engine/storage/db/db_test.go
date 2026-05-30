package db

import (
	"context"
	"database/sql"
	"fmt"
	"sync/atomic"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	_ "modernc.org/sqlite"
)

var testDBCounter atomic.Int64

// schema mirrors the production migrations so we can test queries independently.
const schema = `
CREATE TABLE IF NOT EXISTS history (
    id          TEXT    PRIMARY KEY NOT NULL,
    timestamp   INTEGER NOT NULL,
    request     TEXT    NOT NULL,
    response    TEXT    NOT NULL,
    duration_ms INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
);`

func newTestDB(t *testing.T) *sql.DB {
	t.Helper()
	dsn := "file::memory:?mode=memory&cache=shared&_journal_mode=WAL"
	db, err := sql.Open("sqlite", dsn)
	require.NoError(t, err)
	_, err = db.Exec(schema)
	require.NoError(t, err)
	t.Cleanup(func() { _ = db.Close() })
	return db
}

// newIsolatedTestDB creates a uniquely named in-memory SQLite DB so that
// closing it in a test does not affect the shared cache used by other tests.
func newIsolatedTestDB(t *testing.T) *sql.DB {
	t.Helper()
	id := testDBCounter.Add(1)
	dsn := fmt.Sprintf("file:testdb_%d?mode=memory&cache=shared", id)
	db, err := sql.Open("sqlite", dsn)
	require.NoError(t, err)
	_, err = db.Exec(schema)
	require.NoError(t, err)
	// No automatic cleanup — callers that close the DB explicitly must not
	// register a second Close via Cleanup, but tests that do NOT close it
	// should still clean up.
	t.Cleanup(func() { _ = db.Close() })
	return db
}

func TestNew(t *testing.T) {
	sqlDB := newTestDB(t)
	q := New(sqlDB)
	assert.NotNil(t, q)
}

func TestWithTx(t *testing.T) {
	sqlDB := newTestDB(t)
	tx, err := sqlDB.Begin()
	require.NoError(t, err)
	defer func() { _ = tx.Rollback() }()

	q := New(sqlDB)
	qTx := q.WithTx(tx)
	assert.NotNil(t, qTx)
}

func TestInsertAndGetHistory(t *testing.T) {
	ctx := context.Background()
	q := New(newTestDB(t))

	params := InsertHistoryParams{
		ID:         "h1",
		Timestamp:  1000,
		Request:    `{"url":"https://api.example.com"}`,
		Response:   `{"status":200}`,
		DurationMs: 42,
	}
	require.NoError(t, q.InsertHistory(ctx, params))

	row, err := q.GetHistory(ctx, "h1")
	require.NoError(t, err)
	assert.Equal(t, "h1", row.ID)
	assert.Equal(t, int64(42), row.DurationMs)
}

func TestListHistory(t *testing.T) {
	ctx := context.Background()
	q := New(newTestDB(t))

	for i := int64(1); i <= 3; i++ {
		require.NoError(t, q.InsertHistory(ctx, InsertHistoryParams{
			ID: "h" + string(rune('0'+i)), Timestamp: i * 100,
			Request: `{}`, Response: `{}`, DurationMs: i,
		}))
	}

	rows, err := q.ListHistory(ctx, ListHistoryParams{Limit: 10, Offset: 0})
	require.NoError(t, err)
	assert.Len(t, rows, 3)
}

func TestDeleteHistoryEntry(t *testing.T) {
	ctx := context.Background()
	q := New(newTestDB(t))

	require.NoError(t, q.InsertHistory(ctx, InsertHistoryParams{
		ID: "del1", Timestamp: 1, Request: `{}`, Response: `{}`, DurationMs: 1,
	}))
	require.NoError(t, q.DeleteHistoryEntry(ctx, "del1"))

	_, err := q.GetHistory(ctx, "del1")
	require.Error(t, err)
}

func TestClearHistory(t *testing.T) {
	ctx := context.Background()
	q := New(newTestDB(t))

	require.NoError(t, q.InsertHistory(ctx, InsertHistoryParams{
		ID: "c1", Timestamp: 1, Request: `{}`, Response: `{}`, DurationMs: 1,
	}))
	require.NoError(t, q.ClearHistory(ctx))

	rows, err := q.ListHistory(ctx, ListHistoryParams{Limit: 10, Offset: 0})
	require.NoError(t, err)
	assert.Empty(t, rows)
}

func TestUpsertAndGetSetting(t *testing.T) {
	ctx := context.Background()
	q := New(newTestDB(t))

	require.NoError(t, q.UpsertSetting(ctx, UpsertSettingParams{Key: "theme", Value: "dark"}))

	val, err := q.GetSetting(ctx, "theme")
	require.NoError(t, err)
	assert.Equal(t, "dark", val)
}

func TestUpsertSetting_Update(t *testing.T) {
	ctx := context.Background()
	q := New(newTestDB(t))

	require.NoError(t, q.UpsertSetting(ctx, UpsertSettingParams{Key: "lang", Value: "en"}))
	require.NoError(t, q.UpsertSetting(ctx, UpsertSettingParams{Key: "lang", Value: "fr"}))

	val, err := q.GetSetting(ctx, "lang")
	require.NoError(t, err)
	assert.Equal(t, "fr", val)
}

func TestListSettings(t *testing.T) {
	ctx := context.Background()
	q := New(newTestDB(t))

	require.NoError(t, q.UpsertSetting(ctx, UpsertSettingParams{Key: "k1", Value: "v1"}))
	require.NoError(t, q.UpsertSetting(ctx, UpsertSettingParams{Key: "k2", Value: "v2"}))

	rows, err := q.ListSettings(ctx)
	require.NoError(t, err)
	assert.Len(t, rows, 2)
}

func TestGetHistory_NotFound(t *testing.T) {
	ctx := context.Background()
	q := New(newTestDB(t))

	_, err := q.GetHistory(ctx, "nonexistent-id")
	require.ErrorIs(t, err, sql.ErrNoRows)
}

func TestGetSetting_NotFound(t *testing.T) {
	ctx := context.Background()
	q := New(newTestDB(t))

	_, err := q.GetSetting(ctx, "nonexistent-key")
	require.ErrorIs(t, err, sql.ErrNoRows)
}

func TestListHistory_ClosedDB(t *testing.T) {
	ctx := context.Background()
	sqlDB := newIsolatedTestDB(t)
	q := New(sqlDB)

	require.NoError(t, sqlDB.Close())

	_, err := q.ListHistory(ctx, ListHistoryParams{Limit: 10, Offset: 0})
	require.Error(t, err)
}

func TestListSettings_ClosedDB(t *testing.T) {
	ctx := context.Background()
	sqlDB := newIsolatedTestDB(t)
	q := New(sqlDB)

	require.NoError(t, sqlDB.Close())

	_, err := q.ListSettings(ctx)
	require.Error(t, err)
}
