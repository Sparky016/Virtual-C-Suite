
import Database from 'better-sqlite3';

export class LocalD1Mock {
    private db: Database.Database;

    constructor(filename: string) {
        this.db = new Database(filename);
        this.initializeTables();
    }

    // Initialize tables required by the app
    private initializeTables() {
        // schema matching DatabaseService requirements
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS analysis_requests (
        request_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        file_key TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        completed_at INTEGER,
        error_message TEXT
      );

      CREATE TABLE IF NOT EXISTS executive_analyses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        request_id TEXT NOT NULL,
        executive_role TEXT NOT NULL,
        analysis_text TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY(request_id) REFERENCES analysis_requests(request_id)
      );

      CREATE TABLE IF NOT EXISTS final_reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        request_id TEXT NOT NULL,
        report_content TEXT NOT NULL,
        report_key TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY(request_id) REFERENCES analysis_requests(request_id)
      );

      CREATE TABLE IF NOT EXISTS brand_documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        document_key TEXT NOT NULL,
        original_filename TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        content_type TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS user_settings (
        user_id TEXT PRIMARY KEY,
        inference_provider TEXT NOT NULL,
        vultr_api_key TEXT,
        sambanova_api_key TEXT,
        elevenlabs_api_key TEXT,
        vultr_rag_collection_id TEXT,
        updated_at INTEGER NOT NULL
      );
    `);
    }

    prepare(query: string) {
        // Convert D1 parameter placeholders (?) to SQLite, although better-sqlite3 supports ?
        // The main difference is D1 returns { results: [], meta: {} } structure
        const stmt = this.db.prepare(query);

        return {
            bind: (...args: any[]) => {
                return {
                    first: async () => {
                        try {
                            return stmt.get(...args);
                        } catch (e) {
                            console.error('LocalD1Mock first() error:', e);
                            return null;
                        }
                    },
                    all: async () => {
                        try {
                            const results = stmt.all(...args);
                            return { results };
                        } catch (e) {
                            console.error('LocalD1Mock all() error:', e);
                            throw e;
                        }
                    },
                    run: async () => {
                        try {
                            const info = stmt.run(...args);
                            return {
                                success: true,
                                meta: {
                                    last_row_id: info.lastInsertRowid,
                                    changes: info.changes
                                }
                            };
                        } catch (e) {
                            console.error('LocalD1Mock run() error:', e);
                            throw e;
                        }
                    }
                };
            }
        };
    }

    async batch(statements: any[]) {
        // Not implemented for this mock as it's not strictly used in the observed service yet, 
        // but good to have a placeholder if needed.
        throw new Error("Batch not implemented in LocalD1Mock");
    }

    async exec(query: string) {
        this.db.exec(query);
    }
}
