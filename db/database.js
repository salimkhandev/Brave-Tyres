const DataStore = require('@seald-io/nedb');
const path = require('path');
const os = require('os');
const fs = require('fs');

let db;
let tyresDb;
let salesDb;
let purchasesDb;
let cachedDbPath = null;

function getDatabasePath() {
  // Cache the path to avoid repeated calls
  if (cachedDbPath) {
    return cachedDbPath;
  }
  
  // Always use home directory to avoid electron loading issues
  const userDataPath = path.join(os.homedir(), '.brave-tyres');
  cachedDbPath = userDataPath;
  
  return cachedDbPath;
}

function initDatabase() {
  const dbPath = getDatabasePath();
  
  // Ensure the directory exists
  if (!fs.existsSync(dbPath)) {
    fs.mkdirSync(dbPath, { recursive: true });
  }
  
  console.log('Using database at:', dbPath);
  
  // Initialize NeDB databases
  tyresDb = new DataStore({ 
    filename: path.join(dbPath, 'tyres.db'), 
    autoload: true 
  });
  
  salesDb = new DataStore({ 
    filename: path.join(dbPath, 'sales.db'), 
    autoload: true 
  });
  
  purchasesDb = new DataStore({ 
    filename: path.join(dbPath, 'purchases.db'), 
    autoload: true 
  });
  
  // Ensure indexes
  tyresDb.ensureIndex({ fieldName: 'serial_no', unique: true });
  salesDb.ensureIndex({ fieldName: 'tyre_id' });
  purchasesDb.ensureIndex({ fieldName: 'tyre_id' });
  
  db = {
    tyres: tyresDb,
    sales: salesDb,
    purchases: purchasesDb
  };
  
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