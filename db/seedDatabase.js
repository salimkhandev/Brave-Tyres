const path = require('path');
const os = require('os');

// Import database module
const { initDatabase, getDatabase } = require('./database');

// Initialize database
const db = initDatabase();
console.log('Database initialized for seeding');

// Sample data for generating realistic tyre entries
const sizes = [
  '175/65R14', '185/65R14', '185/70R14', '195/65R15', '195/70R15',
  '205/55R16', '205/60R16', '215/55R16', '215/60R16', '215/65R16',
  '225/55R17', '225/60R17', '225/65R17', '235/55R17', '235/60R17',
  '235/70R16', '245/70R16', '245/75R16', '255/70R16', '265/70R17',
  '275/65R18', '275/70R18', '285/75R16', '31x10.5R15', '33x12.5R15'
];

const prValues = [
  '82H', '84H', '86H', '88H', '91H', '92H', '94V', '95V', '96V',
  '97H', '98V', '99V', '100H', '101H', '102V', '103V', '104H', '105H',
  '106V', '107V', '108H', '110T', '112T', '114T'
];

const patterns = [
  'Symmetric Tread', 'Asymmetric Tread', 'Directional V-Pattern', 
  'All-Season M+S', 'Mud-Terrain AT', 'Highway Terrain HT',
  'Sport Performance', 'Winter Snow', 'Eco-Efficiency',
  'Run-Flat Technology', 'Off-Road 4x4', 'Commercial Van'
];

const brands = [
  'Michelin', 'Bridgestone', 'Goodyear', 'Continental', 'Pirelli',
  'Dunlop', 'Yokohama', 'Hankook', 'Kumho', 'Toyo',
  'Nexen', 'Falken', 'BFGoodrich', 'Cooper', 'General Tire',
  'Firestone', 'Maxxis', 'Nankang', 'GT Radial', 'Triangle'
];

const origins = [
  'Japan', 'Germany', 'USA', 'France', 'Italy',
  'South Korea', 'China', 'Thailand', 'Indonesia',
  'Malaysia', 'India', 'Taiwan', 'Turkey', 'Poland'
];

// Function to generate random number within range
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min, max, decimals = 2) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

// Clear existing data (optional)
console.log('\nClearing existing data...');
db.tyres.remove({}, { multi: true }, (err, numRemoved) => {
  console.log(`Removed ${numRemoved} existing tyre records`);
  
  db.sales.remove({}, { multi: true }, (err, numRemoved) => {
    console.log(`Removed ${numRemoved} existing sale records`);
    
    db.purchases.remove({}, { multi: true }, (err, numRemoved) => {
      console.log(`Removed ${numRemoved} existing purchase records`);
      
      // Generate 50 realistic tyre entries
      console.log('\nGenerating 50 tyre entries with realistic data...');
      
      const tyresToInsert = [];
      for (let i = 1; i <= 50; i++) {
        const serialNo = 'TY-' + String(i).padStart(4, '0');
        const size = sizes[randomInt(0, sizes.length - 1)];
        const pr = prValues[randomInt(0, prValues.length - 1)];
        const pattern = patterns[randomInt(0, patterns.length - 1)];
        const brand = brands[randomInt(0, brands.length - 1)];
        const origin = origins[randomInt(0, origins.length - 1)];
        const quantity = randomInt(5, 45); // Random quantity between 5-45
        const purchasePrice = randomFloat(2500, 8000); // Random price between 2500-8000
        const priceWithDuty = parseFloat((purchasePrice * randomFloat(1.12, 1.18)).toFixed(2)); // 12-18% duty
        const setPrice = parseFloat((priceWithDuty * randomFloat(1.20, 1.35)).toFixed(2)); // 20-35% margin
        const minStockAlert = randomInt(2, 8); // Random min stock between 2-8
        
        const now = Date.now();
        
        tyresToInsert.push({
          id: i,
          serial_no: serialNo,
          size: size,
          pr: pr,
          pattern: pattern,
          brand: brand,
          origin: origin,
          quantity: quantity,
          purchase_price: purchasePrice,
          price_with_duty: priceWithDuty,
          set_price: setPrice,
          min_stock_alert: minStockAlert,
          created_at: now,
          updated_at: now
        });
      }
      
      // Insert tyres one by one to avoid bulk insert issues
      let insertedCount = 0;
      
      function insertNext(index) {
        if (index >= tyresToInsert.length) {
          // All done
          console.log(`✓ Successfully added ${insertedCount} tyre entries to the database!`);
          
          // Verify the count
          db.tyres.count({}, (err, count) => {
            console.log(`\nTotal tyres in database: ${count}`);
            
            // Sample of added data
            db.tyres.find({}).limit(5).exec((err, sample) => {
              console.log('\n📦 Sample of added tyres:');
              sample.forEach(tyre => {
                console.log(`  ${tyre.serial_no}: ${tyre.size} ${tyre.pr} - ${tyre.brand} ${tyre.pattern} (Qty: ${tyre.quantity}, Price: Rs.${tyre.set_price})`);
              });
              
              const dbPath = path.join(os.homedir(), '.brave-tyres');
              console.log(`\n✓ Seeded database location: ${dbPath}`);
              console.log('\n🎉 Database seeding completed successfully!');
              console.log('\n💡 You can now start the app and test the batch stock entry feature!');
              
              process.exit(0);
            });
          });
          return;
        }
        
        // Insert current tyre
        db.tyres.insert(tyresToInsert[index], (err, newDoc) => {
          if (err) {
            console.error(`Error inserting tyre ${index + 1}:`, err.message);
          } else {
            insertedCount++;
            if ((index + 1) % 10 === 0) {
              console.log(`  Inserted ${index + 1}/${tyresToInsert.length} tyres...`);
            }
          }
          
          // Insert next
          insertNext(index + 1);
        });
      }
      
      // Start inserting
      insertNext(0);
    });
  });
});
