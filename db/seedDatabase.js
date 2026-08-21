const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// Use local database path for seeding
const dbPath = path.join(__dirname, '..', 'brave-tyres.sqlite');
const db = new Database(dbPath);

// Clear existing data (optional - comment out if you want to keep existing data)
console.log('Clearing existing tyres...');
db.prepare('DELETE FROM tyres').run();
db.prepare('DELETE FROM sales').run();
db.prepare('DELETE FROM purchases').run();

// Sample data for generating realistic tyre entries
const sizes = ['175/65R14', '185/65R14', '195/65R15', '205/55R16', '215/60R16', '225/65R17', '235/70R16', '245/75R16', '265/70R17', '275/70R18'];
const prValues = ['88H', '91H', '94V', '95V', '97H', '99V', '101H', '103V', '105H', '107V'];
const patterns = ['Symmetric', 'Asymmetric', 'Directional', 'All-Season', 'Mud-Terrain', 'Highway-Terrain'];
const brands = ['Michelin', 'Bridgestone', 'Goodyear', 'Continental', 'Pirelli', 'Dunlop', 'Yokohama', 'Hankook', 'Kumho', 'Toyo'];
const origins = ['Japan', 'Germany', 'USA', 'France', 'Italy', 'South Korea', 'China', 'Thailand', 'Indonesia', 'India'];

// Generate 200 tyre entries
console.log('Generating 200 tyre entries...');
const insertTyre = db.prepare(`
  INSERT INTO tyres (serial_no, size, pr, pattern, brand, origin, quantity, purchase_price, price_with_duty, set_price, min_stock_alert)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

for (let i = 1; i <= 200; i++) {
  const serialNo = 'TY-' + String(i).padStart(4, '0');
  const size = sizes[Math.floor(Math.random() * sizes.length)];
  const pr = prValues[Math.floor(Math.random() * prValues.length)];
  const pattern = patterns[Math.floor(Math.random() * patterns.length)];
  const brand = brands[Math.floor(Math.random() * brands.length)];
  const origin = origins[Math.floor(Math.random() * origins.length)];
  const quantity = Math.floor(Math.random() * 50) + 10; // Random quantity between 10-60
  const purchasePrice = Math.floor(Math.random() * 5000) + 3000; // Random price between 3000-8000
  const priceWithDuty = purchasePrice * 1.15; // Add 15% duty
  const setPrice = priceWithDuty * 1.25; // Add 25% margin
  const minStockAlert = Math.floor(Math.random() * 5) + 2; // Random min stock between 2-7

  insertTyre.run(serialNo, size, pr, pattern, brand, origin, quantity, purchasePrice, priceWithDuty, setPrice, minStockAlert);
}

console.log('Successfully added 200 tyre entries to the database!');

// Verify the count
const count = db.prepare('SELECT COUNT(*) as count FROM tyres').get();
console.log(`Total tyres in database: ${count.count}`);

// Sample of added data
const sample = db.prepare('SELECT * FROM tyres LIMIT 5').all();
console.log('\nSample of added tyres:');
console.log(sample);

// Database is already at the local path
console.log(`\nSeeded database location: ${dbPath}`);

console.log('\nDatabase seeding completed successfully!');
