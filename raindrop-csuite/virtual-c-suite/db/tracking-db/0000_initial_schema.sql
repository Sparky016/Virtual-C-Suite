-- Initial schema for Virtual C-Suite tracking database

-- Analysis Requests Table
CREATE TABLE analysis_requests (
  request_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  file_key TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  completed_at INTEGER,
  error_message TEXT
);

CREATE INDEX idx_user_requests ON analysis_requests(user_id, created_at DESC);
CREATE INDEX idx_status ON analysis_requests(status);

-- Executive Analysis Results Table
CREATE TABLE executive_analyses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id TEXT NOT NULL,
  executive_role TEXT NOT NULL,
  analysis_text TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (request_id) REFERENCES analysis_requests(request_id)
);

CREATE INDEX idx_request_analyses ON executive_analyses(request_id);

-- Final Reports Table
CREATE TABLE final_reports (
  request_id TEXT PRIMARY KEY,
  report_content TEXT NOT NULL,
  report_key TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (request_id) REFERENCES analysis_requests(request_id)
);
