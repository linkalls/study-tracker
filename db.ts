import { Database } from 'bun:sqlite';

const dbFile = process.env.NODE_ENV === 'test' ? 'test_db.sqlite' : 'db.sqlite';
// Delete test database before running tests to ensure a clean state
if (process.env.NODE_ENV === 'test') {
  try {
    const fs = require('node:fs');
    if (fs.existsSync(dbFile)) {
      fs.unlinkSync(dbFile);
      console.log(`Deleted existing test database: ${dbFile}`);
    }
  } catch (err) {
    console.error(`Error deleting test database ${dbFile}:`, err);
  }
}

const db = new Database(dbFile, { create: true });
console.log(`Using database: ${dbFile}`);


// Create users table if it doesn't exist
db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    passwordHash TEXT
  )
`);

// Create study_sessions table if it doesn't exist
db.run(`
  CREATE TABLE IF NOT EXISTS study_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    start_time TEXT NOT NULL, -- ISO 8601 format
    end_time TEXT,            -- ISO 8601 format, nullable for active sessions
    duration_minutes INTEGER DEFAULT 0,
    task_description TEXT,
    pomodoro_cycles INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`);

export default db;
