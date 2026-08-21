const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');

let db;

function getDatabasePath() {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'brave-tyres.sqlite');
}

function initDatabase() {
  const dbPath = getDatabasePath();
  const fs = require('fs');
  
  // Check if we need to copy the seeded database
  const localDbPath = path.join(__dirname, '..', 'brave-tyres.sqlite');
  console.log('Looking for seeded database at:', localDbPath);
  console.log('Seeded database exists:', fs.existsSync(localDbPath));
  
  if (fs.existsSync(localDbPath)) {
    // Ensure the directory exists
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    // Always copy the seeded database for testing
    fs.copyFileSync(localDbPath, dbPath);
    console.log('Copied seeded database to:', dbPath);
  } else {
    console.log('Seeded database not found, creating new database');
  }
  
  db = new Database(dbPath);

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS tyres (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      serial_no TEXT UNIQUE,
      size TEXT NOT NULL,
      pr TEXT,
      pattern TEXT,
      brand TEXT,
      origin TEXT,
      quantity INTEGER NOT NULL DEFAULT 0,
      purchase_price REAL DEFAULT 0,
      price_with_duty REAL DEFAULT 0,
      set_price REAL DEFAULT 0,
      min_stock_alert INTEGER DEFAULT 2,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tyre_id INTEGER REFERENCES tyres(id),
      size TEXT NOT NULL,
      qty_sold INTEGER NOT NULL,
      sale_price REAL NOT NULL,
      total_amount REAL NOT NULL,
      customer_name TEXT,
      note TEXT,
      sold_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tyre_id INTEGER REFERENCES tyres(id),
      qty_added INTEGER NOT NULL,
      cost_price REAL,
      supplier TEXT,
      purchased_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  return db;
}

function getDatabase() {
  if (!db) {
    initDatabase();
  }
  return db;
}

module.exports = {
  initDatabase,
  getDatabase,
  getDatabasePath
};
