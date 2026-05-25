const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/inference_logger.db');

let dbInstance = null;
let SQL = null;

/**
 * Initialize sql.js and the database
 */
async function initDatabase() {
    // Ensure data directory exists
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    // Initialize sql.js
    SQL = await initSqlJs();

    // Load existing database or create new one
    let db;
    if (fs.existsSync(DB_PATH)) {
        const fileBuffer = fs.readFileSync(DB_PATH);
        db = new SQL.Database(fileBuffer);
    } else {
        db = new SQL.Database();
    }

    // Enable WAL mode and foreign keys
    db.run('PRAGMA journal_mode = WAL');
    db.run('PRAGMA foreign_keys = ON');

    // Read and execute schema
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    db.run(schema);

    console.log('Database initialized successfully at:', DB_PATH);

    dbInstance = db;

    // Auto-save to disk every 5 seconds
    setInterval(() => {
        saveDatabase();
    }, 5000);

    return db;
}

/**
 * Save database to disk
 */
function saveDatabase() {
    if (dbInstance) {
        try {
            const data = dbInstance.export();
            const buffer = Buffer.from(data);
            fs.writeFileSync(DB_PATH, buffer);
        } catch (err) {
            console.error('[DB] Failed to save:', err.message);
        }
    }
}

/**
 * Get database instance (sync wrapper)
 */
function getDatabase() {
    if (!dbInstance) {
        throw new Error('Database not initialized. Call initDatabase() first.');
    }
    return dbInstance;
}

/**
 * Helper: Run a query that modifies data (INSERT, UPDATE, DELETE)
 * Returns { changes: number }
 */
function dbRun(sql, params = []) {
    const db = getDatabase();
    db.run(sql, params);
    const result = db.exec('SELECT changes() as changes');
    const changes = result.length > 0 ? result[0].values[0][0] : 0;
    return { changes };
}

/**
 * Helper: Get a single row
 * Returns object or undefined
 */
function dbGet(sql, params = []) {
    const db = getDatabase();
    const stmt = db.prepare(sql);
    stmt.bind(params);
    if (stmt.step()) {
        const columns = stmt.getColumnNames();
        const values = stmt.get();
        stmt.free();
        const row = {};
        columns.forEach((col, i) => { row[col] = values[i]; });
        return row;
    }
    stmt.free();
    return undefined;
}

/**
 * Helper: Get all rows
 * Returns array of objects
 */
function dbAll(sql, params = []) {
    const db = getDatabase();
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) {
        const columns = stmt.getColumnNames();
        const values = stmt.get();
        const row = {};
        columns.forEach((col, i) => { row[col] = values[i]; });
        rows.push(row);
    }
    stmt.free();
    return rows;
}

module.exports = { initDatabase, getDatabase, saveDatabase, dbRun, dbGet, dbAll };
