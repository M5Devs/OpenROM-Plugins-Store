-- Migration 0001 — initial schema for the OpenROM Marketplace (Cloudflare D1).
--
-- `downloads` is a real counter that starts at 0 and is only ever incremented by
-- the /api/download/[id] endpoint. There is deliberately no rating column: the
-- store shows real download counts only, never fabricated stars.

DROP TABLE IF EXISTS plugins;

CREATE TABLE plugins (
    id                 TEXT PRIMARY KEY,
    name               TEXT    NOT NULL,
    version            TEXT    NOT NULL,
    min_core_version   TEXT    NOT NULL,
    publisher_name     TEXT    NOT NULL,
    publisher_verified BOOLEAN NOT NULL DEFAULT 0,
    category           TEXT    NOT NULL,
    description        TEXT    NOT NULL,
    readme_markdown    TEXT,
    routes_json        TEXT,                                  -- e.g. ["ISO -> WUA"]
    platforms_json     TEXT,                                  -- e.g. ["Windows","Linux","macOS"]
    download_url       TEXT    NOT NULL,
    sha256             TEXT    NOT NULL,
    icon               TEXT,
    downloads          INTEGER NOT NULL DEFAULT 0,
    created_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_plugins_category  ON plugins (category);
CREATE INDEX idx_plugins_downloads ON plugins (downloads DESC);
