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
);
