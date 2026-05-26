// Package storage manages system data (history, settings) in a SQLite database.
// The DSN is provided by the caller — this package never resolves OS-specific paths.
package storage

import (
	"context"
	"database/sql"
	"embed"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/golang-migrate/migrate/v4"
	migratesqlite "github.com/golang-migrate/migrate/v4/database/sqlite"
	"github.com/golang-migrate/migrate/v4/source/iofs"

	"github.com/guillaumedelre/reqlet/engine/storage/db"
)

//go:embed migrations/*.sql
var migrationsFS embed.FS

// HistoryEntry is a single request/response record in the history.
type HistoryEntry struct {
	ID         string
	Timestamp  time.Time
	Request    json.RawMessage
	Response   json.RawMessage
	DurationMs int64
}

// HistoryStore persists request/response history.
type HistoryStore interface {
	Insert(ctx context.Context, entry HistoryEntry) error
	List(ctx context.Context, limit, offset int) ([]HistoryEntry, error)
	Get(ctx context.Context, id string) (HistoryEntry, error)
	Delete(ctx context.Context, id string) error
	Clear(ctx context.Context) error
}

// SettingsStore persists key/value application settings.
type SettingsStore interface {
	Get(ctx context.Context, key string) (string, error)
	Set(ctx context.Context, key, value string) error
	List(ctx context.Context) (map[string]string, error)
}

// Storage bundles both stores backed by a single SQLite database.
type Storage struct {
	History  HistoryStore
	Settings SettingsStore
	db       *sql.DB
}

// New opens the SQLite database at dsn, runs any pending migrations, and
// returns a Storage ready for use.
//
// For in-memory databases (tests) use:
//
//	dsn = "file::memory:?cache=shared&mode=memory"
//
// For file-based databases use:
//
//	dsn = "file:/path/to/reqlet.db?cache=shared"
func New(dsn string) (*Storage, error) {
	sqlDB, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, fmt.Errorf("storage: open db: %w", err)
	}
	if err := sqlDB.Ping(); err != nil {
		_ = sqlDB.Close()
		return nil, fmt.Errorf("storage: ping db: %w", err)
	}

	if err := runMigrations(sqlDB); err != nil {
		_ = sqlDB.Close()
		return nil, fmt.Errorf("storage: migrate: %w", err)
	}

	q := db.New(sqlDB)
	return &Storage{
		History:  &historyStore{q: q},
		Settings: &settingsStore{q: q},
		db:       sqlDB,
	}, nil
}

// Close releases the underlying database connection.
func (s *Storage) Close() error {
	return s.db.Close()
}

func runMigrations(sqlDB *sql.DB) error {
	src, err := iofs.New(migrationsFS, "migrations")
	if err != nil {
		return fmt.Errorf("migrations source: %w", err)
	}
	driver, err := migratesqlite.WithInstance(sqlDB, &migratesqlite.Config{
		DatabaseName: "reqlet",
	})
	if err != nil {
		return fmt.Errorf("migrations driver: %w", err)
	}
	m, err := migrate.NewWithInstance("iofs", src, "reqlet", driver)
	if err != nil {
		return fmt.Errorf("migrations init: %w", err)
	}
	if err := m.Up(); err != nil && !errors.Is(err, migrate.ErrNoChange) {
		return err
	}
	return nil
}

// --- historyStore ---

type historyStore struct {
	q *db.Queries
}

func (s *historyStore) Insert(ctx context.Context, e HistoryEntry) error {
	return s.q.InsertHistory(ctx, db.InsertHistoryParams{
		ID:         e.ID,
		Timestamp:  e.Timestamp.UnixMilli(),
		Request:    string(e.Request),
		Response:   string(e.Response),
		DurationMs: e.DurationMs,
	})
}

func (s *historyStore) List(ctx context.Context, limit, offset int) ([]HistoryEntry, error) {
	rows, err := s.q.ListHistory(ctx, db.ListHistoryParams{
		Limit:  int64(limit),
		Offset: int64(offset),
	})
	if err != nil {
		return nil, err
	}
	entries := make([]HistoryEntry, len(rows))
	for i, r := range rows {
		entries[i] = rowToEntry(r)
	}
	return entries, nil
}

func (s *historyStore) Get(ctx context.Context, id string) (HistoryEntry, error) {
	r, err := s.q.GetHistory(ctx, id)
	if err != nil {
		return HistoryEntry{}, err
	}
	return rowToEntry(r), nil
}

func (s *historyStore) Delete(ctx context.Context, id string) error {
	return s.q.DeleteHistoryEntry(ctx, id)
}

func (s *historyStore) Clear(ctx context.Context) error {
	return s.q.ClearHistory(ctx)
}

func rowToEntry(r db.History) HistoryEntry {
	return HistoryEntry{
		ID:         r.ID,
		Timestamp:  time.UnixMilli(r.Timestamp),
		Request:    json.RawMessage(r.Request),
		Response:   json.RawMessage(r.Response),
		DurationMs: r.DurationMs,
	}
}

// --- settingsStore ---

type settingsStore struct {
	q *db.Queries
}

func (s *settingsStore) Get(ctx context.Context, key string) (string, error) {
	row, err := s.q.GetSetting(ctx, key)
	if err != nil {
		return "", err
	}
	return row, nil
}

func (s *settingsStore) Set(ctx context.Context, key, value string) error {
	return s.q.UpsertSetting(ctx, db.UpsertSettingParams{Key: key, Value: value})
}

func (s *settingsStore) List(ctx context.Context) (map[string]string, error) {
	rows, err := s.q.ListSettings(ctx)
	if err != nil {
		return nil, err
	}
	out := make(map[string]string, len(rows))
	for _, r := range rows {
		out[r.Key] = r.Value
	}
	return out, nil
}
