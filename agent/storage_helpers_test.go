package main

import (
	"fmt"
	"testing"

	"github.com/guillaumedelre/reqlet/engine/storage"

	"github.com/stretchr/testify/require"
)

func newTestStorage(t *testing.T) *storage.Storage {
	t.Helper()
	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", t.Name())
	st, err := storage.New(dsn)
	require.NoError(t, err)
	t.Cleanup(func() { _ = st.Close() })
	return st
}

func testServerWithStorage(t *testing.T) (*server, *storage.Storage) {
	t.Helper()
	s := testServer(t)
	st := newTestStorage(t)
	s.storage = st
	return s, st
}
