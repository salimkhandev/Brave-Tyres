const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');
const { initDatabase, getDatabase, getDatabasePath } = require('./db/database');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1000,
    minHeight: 700,
    icon: path.join(__dirname, 'assets', 'logo.png'),
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
  // IPC Handlers
  ipcMain.handle('tyres:getAll', () => {
  try {
    const db = getDatabase();
    const tyres = db.prepare(`
      SELECT *, (quantity * set_price) as total_value 
      FROM tyres 
      ORDER BY created_at DESC
    `).all();
    return { success: true, data: tyres };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('tyres:getById', (event, id) => {
  try {
    const db = getDatabase();
    const tyre = db.prepare('SELECT * FROM tyres WHERE id = ?').get(id);
    return { success: true, data: tyre };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('tyres:create', (event, tyreData) => {
  try {
    const db = getDatabase();
    
    // Generate serial number
    const lastTyre = db.prepare('SELECT serial_no FROM tyres ORDER BY id DESC LIMIT 1').get();
    let nextSerial = 'TY-0001';
    if (lastTyre && lastTyre.serial_no) {
      const lastNum = parseInt(lastTyre.serial_no.replace('TY-', ''));
      nextSerial = 'TY-' + String(lastNum + 1).padStart(4, '0');
    }
    
    const result = db.prepare(`
      INSERT INTO tyres (serial_no, size, pr, pattern, brand, origin, quantity, purchase_price, price_with_duty, set_price, min_stock_alert)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(nextSerial, tyreData.size, tyreData.pr, tyreData.pattern, tyreData.brand, tyreData.origin, tyreData.quantity, tyreData.purchase_price, tyreData.price_with_duty, tyreData.set_price, tyreData.min_stock_alert);
    
    const newTyre = db.prepare('SELECT * FROM tyres WHERE id = ?').get(result.lastInsertRowid);
    return { success: true, data: newTyre };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('tyres:update', (event, id, tyreData) => {
  try {
    const db = getDatabase();
    db.prepare(`
      UPDATE tyres 
      SET size = ?, pr = ?, pattern = ?, brand = ?, origin = ?, quantity = ?, 
          purchase_price = ?, price_with_duty = ?, set_price = ?, min_stock_alert = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(tyreData.size, tyreData.pr, tyreData.pattern, tyreData.brand, tyreData.origin, tyreData.quantity, tyreData.purchase_price, tyreData.price_with_duty, tyreData.set_price, tyreData.min_stock_alert, id);
    
    const updatedTyre = db.prepare('SELECT * FROM tyres WHERE id = ?').get(id);
    return { success: true, data: updatedTyre };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('tyres:delete', (event, id) => {
  try {
    const db = getDatabase();
    db.prepare('DELETE FROM tyres WHERE id = ?').run(id);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('tyres:addStock', (event, id, qtyToAdd, costPrice, supplier) => {
  try {
    const db = getDatabase();
    
    // Get current tyre
    const tyre = db.prepare('SELECT * FROM tyres WHERE id = ?').get(id);
    if (!tyre) {
      return { success: false, error: 'Tyre not found' };
    }
    
    // Update quantity
    const newQty = tyre.quantity + qtyToAdd;
    db.prepare('UPDATE tyres SET quantity = ?, updated_at = datetime("now") WHERE id = ?').run(newQty, id);
    
    // Log purchase
    db.prepare(`
      INSERT INTO purchases (tyre_id, qty_added, cost_price, supplier)
      VALUES (?, ?, ?, ?)
    `).run(id, qtyToAdd, costPrice, supplier);
    
    const updatedTyre = db.prepare('SELECT * FROM tyres WHERE id = ?').get(id);
    return { success: true, data: updatedTyre };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('sales:create', (event, saleData) => {
  try {
    const db = getDatabase();
    
    // Get tyre
    const tyre = db.prepare('SELECT * FROM tyres WHERE id = ?').get(saleData.tyre_id);
    if (!tyre) {
      return { success: false, error: 'Tyre not found' };
    }
    
    // Validate stock
    if (tyre.quantity < saleData.qty_sold) {
      return { success: false, error: 'Not enough stock available' };
    }
    
    // Transaction: deduct stock and log sale
    const transaction = db.transaction(() => {
      // Deduct from tyres
      const newQty = tyre.quantity - saleData.qty_sold;
      db.prepare('UPDATE tyres SET quantity = ?, updated_at = datetime("now") WHERE id = ?').run(newQty, saleData.tyre_id);
      
      // Insert sale
      const totalAmount = saleData.qty_sold * saleData.sale_price;
      const result = db.prepare(`
        INSERT INTO sales (tyre_id, size, qty_sold, sale_price, total_amount, customer_name, note)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(saleData.tyre_id, tyre.size, saleData.qty_sold, saleData.sale_price, totalAmount, saleData.customer_name, saleData.note);
      
      return { lastInsertRowid: result.lastInsertRowid, newQty };
    });
    
    const transactionResult = transaction();
    const updatedTyre = db.prepare('SELECT * FROM tyres WHERE id = ?').get(saleData.tyre_id);
    const newSale = db.prepare('SELECT * FROM sales WHERE id = ?').get(transactionResult.lastInsertRowid);
    
    return { success: true, data: { tyre: updatedTyre, sale: newSale } };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('sales:getAll', (event, filters = {}) => {
  try {
    const db = getDatabase();
    let query = 'SELECT * FROM sales WHERE 1=1';
    const params = [];
    
    if (filters.startDate) {
      query += ' AND sold_at >= ?';
      params.push(filters.startDate);
    }
    
    if (filters.endDate) {
      query += ' AND sold_at <= ?';
      params.push(filters.endDate + ' 23:59:59');
    }
    
    if (filters.size) {
      query += ' AND size LIKE ?';
      params.push('%' + filters.size + '%');
    }
    
    query += ' ORDER BY sold_at DESC';
    
    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }
    
    const sales = db.prepare(query).all(...params);
    return { success: true, data: sales };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('sales:getSummary', (event, filters = {}) => {
  try {
    const db = getDatabase();
    let query = 'SELECT COALESCE(SUM(total_amount), 0) as totalAmount, COALESCE(SUM(qty_sold), 0) as totalUnitsSold, COUNT(*) as count FROM sales WHERE 1=1';
    const params = [];
    
    if (filters.startDate) {
      query += ' AND sold_at >= ?';
      params.push(filters.startDate);
    }
    
    if (filters.endDate) {
      query += ' AND sold_at <= ?';
      params.push(filters.endDate + ' 23:59:59');
    }
    
    if (filters.size) {
      query += ' AND size LIKE ?';
      params.push('%' + filters.size + '%');
    }
    
    const summary = db.prepare(query).get(...params);
    return { success: true, data: summary };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('purchases:getAll', () => {
  try {
    const db = getDatabase();
    const purchases = db.prepare(`
      SELECT p.*, t.size, t.pattern 
      FROM purchases p
      JOIN tyres t ON p.tyre_id = t.id
      ORDER BY p.purchased_at DESC
    `).all();
    return { success: true, data: purchases };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Dashboard handlers
ipcMain.handle('dashboard:getSummary', () => {
  try {
    const db = getDatabase();
    
    // Get tyre summary
    const tyres = db.prepare('SELECT * FROM tyres').all();
    const totalSizes = tyres.length;
    const totalUnits = tyres.reduce((sum, t) => sum + t.quantity, 0);
    const totalValue = tyres.reduce((sum, t) => sum + (t.quantity * t.set_price), 0);
    const lowStockCount = tyres.filter(t => t.quantity <= t.min_stock_alert).length;
    
    // Get today's sales
    const today = new Date().toISOString().split('T')[0];
    const todaySales = db.prepare('SELECT COALESCE(SUM(total_amount), 0) as total FROM sales WHERE sold_at >= ?').get(today);
    
    // Get this month's sales
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const monthSales = db.prepare('SELECT COALESCE(SUM(total_amount), 0) as total FROM sales WHERE sold_at >= ?').get(firstDay);
    
    // Get low stock items
    const lowStockItems = db.prepare('SELECT * FROM tyres WHERE quantity <= min_stock_alert').all();
    
    // Get top selling sizes this month
    const topSelling = db.prepare(`
      SELECT size, SUM(qty_sold) as total_sold
      FROM sales
      WHERE sold_at >= ?
      GROUP BY size
      ORDER BY total_sold DESC
      LIMIT 5
    `).all(firstDay);
    
    return {
      success: true,
      data: {
        totalSizes,
        totalUnits,
        totalValue,
        todaySales: todaySales.total,
        monthSales: monthSales.total,
        lowStockCount,
        lowStockItems,
        topSelling
      }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
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
    
    const db = getDatabase();
    const tyres = db.prepare('SELECT * FROM tyres ORDER BY serial_no').all();
    
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
    return { success: true, path: result.filePath };
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
    
    const db = getDatabase();
    const sales = db.prepare('SELECT * FROM sales ORDER BY sold_at DESC').all();
    
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
    return { success: true, path: result.filePath };
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
    const backupPath = path.join(result.filePaths[0], `brave-tyres-backup-${timestamp}.sqlite`);
    
    fs.copyFileSync(dbPath, backupPath);
    
    return { success: true, path: backupPath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('backup:restore', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [{ name: 'SQLite Files', extensions: ['sqlite', 'db'] }],
      title: 'Select Backup File to Restore'
    });
    
    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, error: 'Restore canceled' };
    }
    
    const dbPath = getDatabasePath();
    const backupPath = result.filePaths[0];
    
    // Close database connection
    const db = getDatabase();
    db.close();
    
    // Copy backup file
    fs.copyFileSync(backupPath, dbPath);
    
    // Reinitialize database
    initDatabase();
    
    return { success: true, path: backupPath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
}

app.whenReady().then(() => {
  // Initialize database before creating window
  initDatabase();
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
