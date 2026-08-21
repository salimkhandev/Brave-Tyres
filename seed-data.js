const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');
const fs = require('fs');

// Try to use Electron's userData path, fallback to local directory
let dbPath;
try {
  const { app } = require('electron');
  const userDataPath = app.getPath('userData');
  dbPath = path.join(userDataPath, 'brave-tyres.sqlite');
} catch (e) {
  // Fallback for running without Electron
  dbPath = path.join(__dirname, 'brave-tyres.sqlite');
}

// Create directory if it doesn't exist
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);

// Create tables if they don't exist
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
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
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
    sold_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tyre_id INTEGER REFERENCES tyres(id),
    qty_added INTEGER NOT NULL,
    cost_price REAL,
    supplier TEXT,
    purchased_at TEXT DEFAULT (datetime('now'))
  );
`);

// Sample data arrays
const sizes = ['185/70R13', '195/65R15', '205/55R16', '215/60R17', '225/50R18', '235/45R19', '245/40R20', '175/65R14', '165/70R13', '195/55R16'];
const prs = ['6PR', '8PR', '10PR', '4PR'];
const patterns = ['Symmetrical', 'Asymmetrical', 'Directional', 'All-Season', 'Performance', 'Touring', 'Mud-Terrain', 'Highway'];
const brands = ['Michelin', 'Bridgestone', 'Goodyear', 'Continental', 'Pirelli', 'Dunlop', 'Yokohama', 'Hankook', 'Kumho', 'Toyo'];
const origins = ['Japan', 'Germany', 'USA', 'China', 'Korea', 'Thailand', 'Indonesia', 'India', 'France', 'Italy'];

// Helper function to get random item from array
function getRandomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Helper function to get random number
function getRandomNumber(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Check if database already has data
const existingCount = db.prepare('SELECT COUNT(*) as count FROM tyres').get();
if (existingCount.count > 0) {
  console.log(`Database already has ${existingCount.count} tyres. Skipping seed data.`);
  console.log('To re-seed, delete the existing data first.');
  db.close();
  process.exit(0);
}

// Generate 200 sample tyres
console.log('Adding 200 sample tyres to database...');

for (let i = 1; i <= 200; i++) {
  const size = getRandomItem(sizes);
  const pr = getRandomItem(prs);
  const pattern = getRandomItem(patterns);
  const brand = getRandomItem(brands);
  const origin = getRandomItem(origins);
  const quantity = getRandomNumber(5, 50);
  const purchasePrice = getRandomNumber(3000, 8000);
  const priceWithDuty = purchasePrice + getRandomNumber(500, 2000);
  const setPrice = priceWithDuty + getRandomNumber(1000, 3000);
  const minStockAlert = getRandomNumber(2, 10);
  
  // Generate serial number
  const serialNo = 'TY-' + String(i).padStart(4, '0');
  
  try {
    db.prepare(`
      INSERT INTO tyres (serial_no, size, pr, pattern, brand, origin, quantity, purchase_price, price_with_duty, set_price, min_stock_alert)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(serialNo, size, pr, pattern, brand, origin, quantity, purchasePrice, priceWithDuty, setPrice, minStockAlert);
    
    console.log(`Added tyre ${i}: ${serialNo} - ${brand} ${size}`);
  } catch (error) {
    console.error(`Error adding tyre ${i}:`, error.message);
  }
}

console.log('✅ Successfully added 200 sample tyres to database!');
console.log(`Database location: ${dbPath}`);

db.close();
