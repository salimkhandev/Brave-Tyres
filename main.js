const electron = require('electron');
const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');

const app = electron.app;
const BrowserWindow = electron.BrowserWindow;
const ipcMain = electron.ipcMain;
const dialog = electron.dialog;

let mainWindow;
let db;
let initDatabase, getDatabase, getDatabasePath;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1000,
    minHeight: 700,
    icon: path.join(__dirname, 'assets', 'icon.ico'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js')
    },
    title: 'Brave Tyres Management'
  });

  mainWindow.loadFile('renderer/index.html');

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function setupIPCHandlers() {
  // IPC Handlers using direct NeDB API
  ipcMain.handle('tyres:getAll', () => {
    return new Promise((resolve, reject) => {
      const database = getDatabase();
      database.tyres.find({}).sort({ id: 1 }).exec((err, tyres) => {
        if (err) {
          resolve({ success: false, error: err.message });
        } else {
          const tyresWithTotal = tyres.map(tyre => ({
            ...tyre,
            total_value: tyre.quantity * tyre.set_price
          }));
          resolve({ success: true, data: tyresWithTotal });
        }
      });
    });
  });

ipcMain.handle('tyres:getById', (event, id) => {
  return new Promise((resolve, reject) => {
    getDatabase().tyres.findOne({ id: id }, (err, tyre) => {
      if (err) {
        resolve({ success: false, error: err.message });
      } else {
        resolve({ success: true, data: tyre });
      }
    });
  });
});

ipcMain.handle('tyres:create', (event, tyreData) => {
  return new Promise((resolve, reject) => {
    // Generate serial number
    getDatabase().tyres.find({}).sort({ id: -1 }).limit(1).exec((err, docs) => {
      if (err) {
        resolve({ success: false, error: err.message });
        return;
      }
      
      let nextSerial = 'TY-0001';
      if (docs.length > 0 && docs[0].serial_no) {
        const lastNum = parseInt(docs[0].serial_no.replace('TY-', ''));
        nextSerial = 'TY-' + String(lastNum + 1).padStart(4, '0');
      }
      
      // Get next ID
      getDatabase().tyres.find({}).sort({ id: -1 }).limit(1).exec((err, docs) => {
        if (err) {
          resolve({ success: false, error: err.message });
          return;
        }
        
        const nextId = docs.length > 0 ? docs[0].id + 1 : 1;
        const now = new Date();
        const localISO = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString();
        
        const newTyre = {
          id: nextId,
          serial_no: nextSerial,
          size: tyreData.size,
          pr: tyreData.pr,
          pattern: tyreData.pattern,
          brand: tyreData.brand,
          origin: tyreData.origin,
          quantity: tyreData.quantity,
          purchase_price: tyreData.purchase_price,
          price_with_duty: tyreData.price_with_duty,
          set_price: tyreData.set_price,
          min_stock_alert: tyreData.min_stock_alert,
          created_at: localISO,
          updated_at: localISO
        };
        
        getDatabase().tyres.insert(newTyre, (err, doc) => {
          if (err) {
            resolve({ success: false, error: err.message });
          } else {
            resolve({ success: true, data: doc });
          }
        });
      });
    });
  });
});

ipcMain.handle('tyres:update', (event, id, tyreData) => {
  return new Promise((resolve, reject) => {
    const now = Date.now();
    
    getDatabase().tyres.update(
      { id: id },
      { 
        $set: {
          size: tyreData.size,
          pr: tyreData.pr,
          pattern: tyreData.pattern,
          brand: tyreData.brand,
          origin: tyreData.origin,
          quantity: tyreData.quantity,
          purchase_price: tyreData.purchase_price,
          price_with_duty: tyreData.price_with_duty,
          set_price: tyreData.set_price,
          min_stock_alert: tyreData.min_stock_alert,
          updated_at: now
        }
      },
      {},
      (err, numReplaced) => {
        if (err) {
          resolve({ success: false, error: err.message });
        } else {
          getDatabase().tyres.findOne({ id: id }, (err, tyre) => {
            if (err) {
              resolve({ success: false, error: err.message });
            } else {
              resolve({ success: true, data: tyre });
            }
          });
        }
      }
    );
  });
});

ipcMain.handle('tyres:delete', (event, id) => {
  return new Promise((resolve, reject) => {
    getDatabase().tyres.remove({ id: id }, {}, (err, numRemoved) => {
      if (err) {
        resolve({ success: false, error: err.message });
      } else {
        resolve({ success: true });
      }
    });
  });
});

ipcMain.handle('tyres:addStock', (event, id, qtyToAdd, costPrice, supplier) => {
  return new Promise((resolve, reject) => {
    // Get current tyre
    getDatabase().tyres.findOne({ id: id }, (err, tyre) => {
      if (err) {
        resolve({ success: false, error: err.message });
        return;
      }
      
      if (!tyre) {
        resolve({ success: false, error: 'Tyre not found' });
        return;
      }
      
      // Update quantity
      const newQty = tyre.quantity + qtyToAdd;
      const now = Date.now();
      
      getDatabase().tyres.update(
        { id: id },
        { $set: { quantity: newQty, updated_at: now } },
        {},
        (err, numReplaced) => {
          if (err) {
            resolve({ success: false, error: err.message });
            return;
          }
          
          // Log purchase
          const purchaseId = Date.now(); // Simple ID generation
          getDatabase().purchases.insert({
            id: purchaseId,
            tyre_id: id,
            qty_added: qtyToAdd,
            cost_price: costPrice,
            supplier: supplier,
            purchased_at: now
          }, (err) => {
            if (err) {
              resolve({ success: false, error: err.message });
              return;
            }
            
            // Get updated tyre
            getDatabase().tyres.findOne({ id: id }, (err, updatedTyre) => {
              if (err) {
                resolve({ success: false, error: err.message });
              } else {
                resolve({ success: true, data: updatedTyre });
              }
            });
          });
        }
      );
    });
  });
});

ipcMain.handle('sales:create', (event, saleData) => {
  return new Promise((resolve, reject) => {
    // Get tyre
    getDatabase().tyres.findOne({ id: saleData.tyre_id }, (err, tyre) => {
      if (err) {
        resolve({ success: false, error: err.message });
        return;
      }
      
      if (!tyre) {
        resolve({ success: false, error: 'Tyre not found' });
        return;
      }
      
      // Validate stock
      if (tyre.quantity < saleData.qty_sold) {
        resolve({ success: false, error: 'Not enough stock available' });
        return;
      }
      
      // Deduct from tyres
      const newQty = tyre.quantity - saleData.qty_sold;
      const now = Date.now();
      
      getDatabase().tyres.update(
        { id: saleData.tyre_id },
        { $set: { quantity: newQty, updated_at: now } },
        {},
        (err, numReplaced) => {
          if (err) {
            resolve({ success: false, error: err.message });
            return;
          }
          
          // Insert sale
          const totalAmount = saleData.qty_sold * saleData.sale_price;
          const saleId = Date.now(); // Simple ID generation
          
          getDatabase().sales.insert({
            id: saleId,
            tyre_id: saleData.tyre_id,
            size: tyre.size,
            qty_sold: saleData.qty_sold,
            sale_price: saleData.sale_price,
            total_amount: totalAmount,
            customer_name: saleData.customer_name,
            note: saleData.note,
            sold_at: now
          }, (err, newSale) => {
            if (err) {
              resolve({ success: false, error: err.message });
              return;
            }
            
            // Get updated tyre
            getDatabase().tyres.findOne({ id: saleData.tyre_id }, (err, updatedTyre) => {
              if (err) {
                resolve({ success: false, error: err.message });
              } else {
                resolve({ success: true, data: { tyre: updatedTyre, sale: newSale } });
              }
            });
          });
        }
      );
    });
  });
});

ipcMain.handle('sales:getAll', (event, filters = {}) => {
  return new Promise((resolve, reject) => {
    let query = {};
    
    if (filters.startDate || filters.endDate) {
      query.sold_at = {};
      if (filters.startDate) {
        const startTime = new Date(filters.startDate).getTime();
        query.sold_at.$gte = startTime;
      }
      if (filters.endDate) {
        const endTime = new Date(filters.endDate).getTime() + 86400000; // End of day
        query.sold_at.$lte = endTime;
      }
    }
    
    if (filters.size) {
      query.size = new RegExp(filters.size, 'i');
    }
    
    getDatabase().sales.find(query).sort({ sold_at: -1 }).limit(filters.limit || 0).exec((err, sales) => {
      if (err) {
        resolve({ success: false, error: err.message });
      } else {
        resolve({ success: true, data: sales });
      }
    });
  });
});

ipcMain.handle('sales:getSummary', (event, filters = {}) => {
  return new Promise((resolve, reject) => {
    let query = {};
    
    if (filters.startDate || filters.endDate) {
      query.sold_at = {};
      if (filters.startDate) {
        const startTime = new Date(filters.startDate).getTime();
        query.sold_at.$gte = startTime;
      }
      if (filters.endDate) {
        const endTime = new Date(filters.endDate).getTime() + 86400000; // End of day
        query.sold_at.$lte = endTime;
      }
    }
    
    if (filters.size) {
      query.size = new RegExp(filters.size, 'i');
    }
    
    getDatabase().sales.find(query).exec((err, sales) => {
      if (err) {
        resolve({ success: false, error: err.message });
      } else {
        const totalAmount = sales.reduce((sum, sale) => sum + sale.total_amount, 0);
        const totalUnitsSold = sales.reduce((sum, sale) => sum + sale.qty_sold, 0);
        resolve({ 
          success: true, 
          data: { 
            totalAmount, 
            totalUnitsSold, 
            count: sales.length 
          } 
        });
      }
    });
  });
});

ipcMain.handle('purchases:getAll', () => {
  return new Promise((resolve, reject) => {
    getDatabase().purchases.find({}).sort({ purchased_at: -1 }).exec((err, purchases) => {
      if (err) {
        resolve({ success: false, error: err.message });
      } else {
        // Enrich with tyre data
        const enrichedPurchases = purchases.map(purchase => {
          return new Promise((resolvePurchase) => {
            getDatabase().tyres.findOne({ id: purchase.tyre_id }, (err, tyre) => {
              if (err || !tyre) {
                resolvePurchase({ ...purchase, size: 'Unknown', pattern: 'Unknown' });
              } else {
                resolvePurchase({ ...purchase, size: tyre.size, pattern: tyre.pattern });
              }
            });
          });
        });
        
        Promise.all(enrichedPurchases).then(results => {
          resolve({ success: true, data: results });
        });
      }
    });
  });
});

// Dashboard handlers
ipcMain.handle('dashboard:getSummary', () => {
  return new Promise((resolve, reject) => {
    // Get tyre summary
    getDatabase().tyres.find({}).exec((err, tyres) => {
      if (err) {
        resolve({ success: false, error: err.message });
        return;
      }
      
      const totalSizes = tyres.length;
      const totalUnits = tyres.reduce((sum, t) => sum + t.quantity, 0);
      const totalValue = tyres.reduce((sum, t) => sum + (t.quantity * t.set_price), 0);
      const lowStockCount = tyres.filter(t => t.quantity <= t.min_stock_alert).length;
      const lowStockItems = tyres.filter(t => t.quantity <= t.min_stock_alert);
      
      // Get today's sales (using timestamp comparison)
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const todayEnd = todayStart + 86400000; // 24 hours in milliseconds
      
      getDatabase().sales.find({}).exec((err, allSales) => {
        if (err) {
          resolve({ success: false, error: err.message });
          return;
        }
        
        const todaySales = allSales
          .filter(sale => sale.sold_at >= todayStart && sale.sold_at < todayEnd)
          .reduce((sum, sale) => sum + sale.total_amount, 0);
        
        // Get this month's sales
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
        const monthSales = allSales
          .filter(sale => sale.sold_at >= monthStart)
          .reduce((sum, sale) => sum + sale.total_amount, 0);
        
        // Get top selling sizes this month
        const thisMonthSales = allSales.filter(sale => sale.sold_at >= monthStart);
        const sizeSales = {};
        thisMonthSales.forEach(sale => {
          if (!sizeSales[sale.size]) {
            sizeSales[sale.size] = 0;
          }
          sizeSales[sale.size] += sale.qty_sold;
        });
        
        const topSelling = Object.entries(sizeSales)
          .map(([size, total_sold]) => ({ size, total_sold }))
          .sort((a, b) => b.total_sold - a.total_sold)
          .slice(0, 5);
        
        resolve({
          success: true,
          data: {
            totalSizes,
            totalUnits,
            totalValue,
            todaySales,
            monthSales,
            lowStockCount,
            lowStockItems,
            topSelling
          }
        });
      });
    });
  });
});

// Export handlers
ipcMain.handle('export:stock:excel', async () => {
  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: `brave-tyres-stock-${new Date().toISOString().split('T')[0]}.xlsx`,
      filters: [{ name: 'Excel Files', extensions: ['xlsx'] }]
    });
    
    if (result.canceled) {
      return { success: false, error: 'Export canceled' };
    }
    
    return new Promise((resolve, reject) => {
      getDatabase().tyres.find({}).sort({ serial_no: 1 }).exec(async (err, tyres) => {
        if (err) {
          resolve({ success: false, error: err.message });
          return;
        }
        
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Stock');
        
        // Add headers
        worksheet.columns = [
          { header: 'S.No', key: 'serial_no', width: 15 },
          { header: 'Size', key: 'size', width: 15 },
          { header: 'PR', key: 'pr', width: 10 },
          { header: 'Pattern', key: 'pattern', width: 15 },
          { header: 'Brand', key: 'brand', width: 15 },
          { header: 'Origin', key: 'origin', width: 15 },
          { header: 'Quantity', key: 'quantity', width: 10 },
          { header: 'Purchase Price', key: 'purchase_price', width: 15 },
          { header: 'Price with Duty', key: 'price_with_duty', width: 15 },
          { header: 'Set Price', key: 'set_price', width: 15 },
          { header: 'Min Stock Alert', key: 'min_stock_alert', width: 15 },
          { header: 'Total Value', key: 'total_value', width: 15 }
        ];
        
        // Style header row
        worksheet.getRow(1).font = { bold: true, size: 12 };
        worksheet.getRow(1).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE0E0E0' }
        };
        
        // Add data
        tyres.forEach(tyre => {
          worksheet.addRow({
            serial_no: tyre.serial_no,
            size: tyre.size,
            pr: tyre.pr || '',
            pattern: tyre.pattern || '',
            brand: tyre.brand || '',
            origin: tyre.origin || '',
            quantity: tyre.quantity,
            purchase_price: tyre.purchase_price,
            price_with_duty: tyre.price_with_duty,
            set_price: tyre.set_price,
            min_stock_alert: tyre.min_stock_alert,
            total_value: tyre.quantity * tyre.set_price
          });
        });
        
        // Format currency columns
        worksheet.eachRow((row, rowNumber) => {
          if (rowNumber > 1) {
            row.getCell(8).numFmt = '#,##0.00'; // Purchase Price
            row.getCell(9).numFmt = '#,##0.00'; // Price with Duty
            row.getCell(10).numFmt = '#,##0.00'; // Set Price
            row.getCell(12).numFmt = '#,##0.00'; // Total Value
          }
        });
        
        await workbook.xlsx.writeFile(result.filePath);
        resolve({ success: true, path: result.filePath });
      });
    });
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('export:sales:excel', async () => {
  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: `brave-tyres-sales-${new Date().toISOString().split('T')[0]}.xlsx`,
      filters: [{ name: 'Excel Files', extensions: ['xlsx'] }]
    });
    
    if (result.canceled) {
      return { success: false, error: 'Export canceled' };
    }
    
    return new Promise((resolve, reject) => {
      getDatabase().sales.find({}).sort({ sold_at: -1 }).exec(async (err, sales) => {
        if (err) {
          resolve({ success: false, error: err.message });
          return;
        }
        
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Sales');
        
        // Add headers
        worksheet.columns = [
          { header: 'Date', key: 'sold_at', width: 20 },
          { header: 'Size', key: 'size', width: 15 },
          { header: 'Qty Sold', key: 'qty_sold', width: 10 },
          { header: 'Sale Price', key: 'sale_price', width: 15 },
          { header: 'Total Amount', key: 'total_amount', width: 15 },
          { header: 'Customer', key: 'customer_name', width: 20 },
          { header: 'Note', key: 'note', width: 30 }
        ];
        
        // Style header row
        worksheet.getRow(1).font = { bold: true, size: 12 };
        worksheet.getRow(1).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE0E0E0' }
        };
        
        // Add data
        sales.forEach(sale => {
          worksheet.addRow({
            sold_at: sale.sold_at,
            size: sale.size,
            qty_sold: sale.qty_sold,
            sale_price: sale.sale_price,
            total_amount: sale.total_amount,
            customer_name: sale.customer_name || '',
            note: sale.note || ''
          });
        });
        
        // Format currency columns
        worksheet.eachRow((row, rowNumber) => {
          if (rowNumber > 1) {
            row.getCell(4).numFmt = '#,##0.00'; // Sale Price
            row.getCell(5).numFmt = '#,##0.00'; // Total Amount
          }
        });
        
        await workbook.xlsx.writeFile(result.filePath);
        resolve({ success: true, path: result.filePath });
      });
    });
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Backup handlers
ipcMain.handle('backup:getInfo', () => {
  try {
    const dbPath = getDatabasePath();
    const stats = fs.statSync(dbPath);
    
    return {
      success: true,
      data: {
        path: dbPath,
        size: (stats.size / 1024).toFixed(2) + ' KB',
        modified: stats.mtime.toLocaleString()
      }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('backup:create', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: 'Select Backup Location'
    });
    
    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, error: 'Backup canceled' };
    }
    
    const dbPath = getDatabasePath();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0] + '-' + new Date().toTimeString().split(' ')[0].replace(/:/g, '');
    const backupPath = path.join(result.filePaths[0], `brave-tyres-backup-${timestamp}`);
    
    // Create backup directory
    if (!fs.existsSync(backupPath)) {
      fs.mkdirSync(backupPath, { recursive: true });
    }
    
    // Copy all database files
    const dbFiles = ['tyres.db', 'sales.db', 'purchases.db'];
    dbFiles.forEach(dbFile => {
      const srcPath = path.join(dbPath, dbFile);
      const destPath = path.join(backupPath, dbFile);
      if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, destPath);
      }
    });
    
    return { success: true, path: backupPath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('backup:restore', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [{ name: 'Database Files', extensions: ['db'] }],
      title: 'Select Backup File to Restore'
    });
    
    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, error: 'Restore canceled' };
    }
    
    const dbPath = getDatabasePath();
    const backupPath = result.filePaths[0];
    
    // Copy backup file
    const fileName = path.basename(backupPath);
    const destPath = path.join(dbPath, fileName);
    fs.copyFileSync(backupPath, destPath);
    
    // Reload databases
    const database = getDatabase();
    database.tyres.loadDatabase();
    database.sales.loadDatabase();
    database.purchases.loadDatabase();
    
    return { success: true, path: backupPath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
}

app.whenReady().then(() => {
  // Load database module after app is ready
  const dbModule = require('./db/database');
  initDatabase = dbModule.initDatabase;
  getDatabase = dbModule.getDatabase;
  getDatabasePath = dbModule.getDatabasePath;
  
  // Initialize database before creating window
  db = initDatabase();
  console.log('Database initialized at:', getDatabasePath());
  
  // Setup IPC handlers
  setupIPCHandlers();
  
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
