-- Add brand_documents table for storing user brand document metadata
-- This table supports brand context injection into CEO chat

CREATE TABLE IF NOT EXISTS brand_documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  document_key TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  content_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('active', 'inactive')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(user_id, status)
);

CREATE INDEX IF NOT EXISTS idx_brand_documents_user_status
  ON brand_documents(user_id, status);
