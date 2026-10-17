-- Cloudflare D1 Database Schema for OpenROM Plugin Store

DROP TABLE IF EXISTS plugins;
DROP TABLE IF EXISTS publishers;

-- Publishers table
CREATE TABLE publishers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    github TEXT,
    is_verified INTEGER DEFAULT 0 NOT NULL,
    badge TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Plugins table
CREATE TABLE plugins (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    version TEXT NOT NULL,
    author_id TEXT NOT NULL,
    description TEXT NOT NULL,
    conversions TEXT NOT NULL, -- JSON array string or comma-separated list
    tags TEXT,                 -- JSON array string or comma-separated list
    icon TEXT,
    download_url TEXT NOT NULL,
    homepage TEXT,
    license TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    FOREIGN KEY (author_id) REFERENCES publishers(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX idx_publishers_verified ON publishers(is_verified);
CREATE INDEX idx_plugins_author ON plugins(author_id);
