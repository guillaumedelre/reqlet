-- name: InsertHistory :exec
INSERT INTO history (id, timestamp, request, response, duration_ms)
VALUES (?, ?, ?, ?, ?);

-- name: ListHistory :many
SELECT id, timestamp, request, response, duration_ms
FROM history
ORDER BY timestamp DESC
LIMIT ? OFFSET ?;

-- name: GetHistory :one
SELECT id, timestamp, request, response, duration_ms
FROM history
WHERE id = ?;

-- name: DeleteHistoryEntry :exec
DELETE FROM history WHERE id = ?;

-- name: ClearHistory :exec
DELETE FROM history;
