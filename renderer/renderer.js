// Global state
let allTyres = [];
let allSales = [];
let currentFilters = {};

// Navigation
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(btn.dataset.section).classList.add('active');
    
    // Load data when switching sections
    if (btn.dataset.section === 'dashboard') {
      loadDashboard();
    } else if (btn.dataset.section === 'stock') {
      loadStockTable();
    } else if (btn.dataset.section === 'sell') {
      loadSellTyres();
    } else if (btn.dataset.section === 'sales-history') {
      loadSalesHistory();
    } else if (btn.dataset.section === 'backup') {
      loadBackupInfo();
    }
  });
});

// Utility functions
function formatCurrency(amount) {
  return 'Rs. ' + Math.round(Number(amount)).toLocaleString('en-PK');
}

function adjustCardFontSize(elementId) {
  const element = document.getElementById(elementId);
  if (!element) return;
  
  const text = element.textContent;
  const length = text.length;
  
  // If text is very long, reduce font size
  if (length > 15) {
    element.style.fontSize = '1.2rem';
  } else if (length > 12) {
    element.style.fontSize = '1.4rem';
  } else {
    element.style.fontSize = '';
  }
}

function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type}`;
  setTimeout(() => {
    toast.className = 'toast';
  }, 3000);
}

// Stock Table
async function loadStockTable() {
  const result = await window.api.tyres.getAll();
  if (result.success) {
    allTyres = result.data;
    renderStockTable(allTyres);
  }
}

function renderStockTable(tyres) {
  const tbody = document.getElementById('stockTableBody');
  tbody.innerHTML = '';
  
  let totalSizes = 0;
  let totalUnits = 0;
  let totalValue = 0;
  
  tyres.forEach(tyre => {
    totalSizes++;
    totalUnits += tyre.quantity;
    totalValue += (tyre.quantity * tyre.set_price);
    
    const row = document.createElement('tr');
    if (tyre.quantity <= tyre.min_stock_alert) {
      row.classList.add('low-stock');
    }
    
    row.innerHTML = `
      <td>${tyre.serial_no}</td>
      <td>${tyre.size}</td>
      <td>${tyre.pr || '-'}</td>
      <td>${tyre.pattern || '-'}</td>
      <td>${tyre.brand || '-'}</td>
      <td>${tyre.quantity}</td>
      <td>${formatCurrency(tyre.price_with_duty)}</td>
      <td>${formatCurrency(tyre.set_price)}</td>
      <td>${formatCurrency(tyre.quantity * tyre.set_price)}</td>
      <td>
        <button class="btn btn-sm btn-secondary" onclick="editTyre(${tyre.id})">Edit</button>
        <button class="btn btn-sm btn-secondary" onclick="openAddStockModal(${tyre.id})">Add Stock</button>
        <button class="btn btn-sm btn-danger" onclick="deleteTyre(${tyre.id})">Delete</button>
      </td>
    `;
    tbody.appendChild(row);
  });
  
  document.getElementById('stockFooter').innerHTML = `
    <span>Total Sizes: ${totalSizes}</span>
    <span>Total Units in Stock: ${totalUnits}</span>
    <span>Total Stock Value: ${formatCurrency(totalValue)}</span>
  `;
}

// Search functionality
document.getElementById('stockSearch').addEventListener('input', (e) => {
  const searchTerm = e.target.value.toLowerCase();
  const filtered = allTyres.filter(tyre => 
    (tyre.size && tyre.size.toLowerCase().includes(searchTerm)) ||
    (tyre.pattern && tyre.pattern.toLowerCase().includes(searchTerm)) ||
    (tyre.brand && tyre.brand.toLowerCase().includes(searchTerm))
  );
  renderStockTable(filtered);
});

// Tyre Form Modal
const tyreModal = document.getElementById('tyreModal');
const tyreForm = document.getElementById('tyreForm');

document.getElementById('addTyreBtn').addEventListener('click', () => {
  document.getElementById('modalTitle').textContent = 'Add New Tyre';
  tyreForm.reset();
  document.getElementById('tyreId').value = '';
  document.getElementById('tyreSerial').value = 'Auto-generated';
  tyreModal.classList.add('active');
});

document.getElementById('closeModal').addEventListener('click', () => {
  tyreModal.classList.remove('active');
});

document.getElementById('cancelBtn').addEventListener('click', () => {
  tyreModal.classList.remove('active');
});

tyreForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const tyreData = {
    size: document.getElementById('tyreSize').value,
    pr: document.getElementById('tyrePR').value,
    pattern: document.getElementById('tyrePattern').value,
    brand: document.getElementById('tyreBrand').value,
    origin: document.getElementById('tyreOrigin').value,
    quantity: parseInt(document.getElementById('tyreQty').value),
    purchase_price: parseFloat(document.getElementById('tyrePurchasePrice').value) || 0,
    price_with_duty: parseFloat(document.getElementById('tyrePriceWithDuty').value) || 0,
    set_price: parseFloat(document.getElementById('tyreSetPrice').value),
    min_stock_alert: parseInt(document.getElementById('tyreMinStock').value) || 2
  };
  
  const tyreId = document.getElementById('tyreId').value;
  
  let result;
  if (tyreId) {
    result = await window.api.tyres.update(parseInt(tyreId), tyreData);
  } else {
    result = await window.api.tyres.create(tyreData);
  }
  
  if (result.success) {
    showToast(tyreId ? 'Tyre updated successfully' : 'Tyre added successfully');
    tyreModal.classList.remove('active');
    loadStockTable();
  } else {
    showToast(result.error, 'error');
  }
});

window.editTyre = async (id) => {
  const result = await window.api.tyres.getById(id);
  if (result.success) {
    const tyre = result.data;
    document.getElementById('modalTitle').textContent = 'Edit Tyre';
    document.getElementById('tyreId').value = tyre.id;
    document.getElementById('tyreSerial').value = tyre.serial_no;
    document.getElementById('tyreSize').value = tyre.size;
    document.getElementById('tyrePR').value = tyre.pr || '';
    document.getElementById('tyrePattern').value = tyre.pattern || '';
    document.getElementById('tyreBrand').value = tyre.brand || '';
    document.getElementById('tyreOrigin').value = tyre.origin || '';
    document.getElementById('tyreQty').value = tyre.quantity;
    document.getElementById('tyrePurchasePrice').value = tyre.purchase_price || '';
    document.getElementById('tyrePriceWithDuty').value = tyre.price_with_duty || '';
    document.getElementById('tyreSetPrice').value = tyre.set_price;
    document.getElementById('tyreMinStock').value = tyre.min_stock_alert;
    tyreModal.classList.add('active');
  }
};

window.deleteTyre = async (id) => {
  if (confirm('Are you sure you want to delete this tyre?')) {
    const result = await window.api.tyres.delete(id);
    if (result.success) {
      showToast('Tyre deleted successfully');
      loadStockTable();
    } else {
      showToast(result.error, 'error');
    }
  }
};

// Add Stock Modal
const addStockModal = document.getElementById('addStockModal');
const addStockForm = document.getElementById('addStockForm');

window.openAddStockModal = async (id) => {
  document.getElementById('addStockTyreId').value = id;
  addStockForm.reset();
  addStockModal.classList.add('active');
};

document.getElementById('closeAddStockModal').addEventListener('click', () => {
  addStockModal.classList.remove('active');
});

document.getElementById('cancelAddStockBtn').addEventListener('click', () => {
  addStockModal.classList.remove('active');
});

addStockForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const tyreId = parseInt(document.getElementById('addStockTyreId').value);
  const qty = parseInt(document.getElementById('addStockQty').value);
  const costPrice = parseFloat(document.getElementById('addStockCostPrice').value) || null;
  const supplier = document.getElementById('addStockSupplier').value || null;
  
  const result = await window.api.tyres.addStock(tyreId, qty, costPrice, supplier);
  
  if (result.success) {
    showToast(`Added ${qty} units to stock`);
    addStockModal.classList.remove('active');
    loadStockTable();
  } else {
    showToast(result.error, 'error');
  }
});

// Sell Section
async function loadSellTyres() {
  const result = await window.api.tyres.getAll();
  if (result.success) {
    const select = document.getElementById('sellTyreSelect');
    select.innerHTML = '<option value="">-- Select a tyre --</option>';
    
    result.data.filter(t => t.quantity > 0).forEach(tyre => {
      const option = document.createElement('option');
      option.value = tyre.id;
      option.textContent = `${tyre.size} — ${tyre.pattern || 'N/A'} (Qty available: ${tyre.quantity})`;
      option.dataset.tyre = JSON.stringify(tyre);
      select.appendChild(option);
    });
    
    loadRecentSales();
  }
}

document.getElementById('sellTyreSelect').addEventListener('change', (e) => {
  const selectedOption = e.target.selectedOptions[0];
  if (selectedOption && selectedOption.value) {
    const tyre = JSON.parse(selectedOption.dataset.tyre);
    document.getElementById('tyreDetails').style.display = 'block';
    document.getElementById('detailSize').textContent = tyre.size;
    document.getElementById('detailPR').textContent = tyre.pr || '-';
    document.getElementById('detailPattern').textContent = tyre.pattern || '-';
    document.getElementById('detailStock').textContent = tyre.quantity;
    document.getElementById('detailPrice').textContent = formatCurrency(tyre.set_price);
    document.getElementById('sellPrice').value = tyre.set_price;
    document.getElementById('sellQty').max = tyre.quantity;
    calculateTotal();
  } else {
    document.getElementById('tyreDetails').style.display = 'none';
  }
});

document.getElementById('sellQty').addEventListener('input', calculateTotal);
document.getElementById('sellPrice').addEventListener('input', calculateTotal);

function calculateTotal() {
  const qty = parseInt(document.getElementById('sellQty').value) || 0;
  const price = parseFloat(document.getElementById('sellPrice').value) || 0;
  document.getElementById('totalAmount').textContent = Math.round(qty * price).toLocaleString('en-PK');
}

document.getElementById('confirmSaleBtn').addEventListener('click', async () => {
  const tyreId = parseInt(document.getElementById('sellTyreSelect').value);
  const qty = parseInt(document.getElementById('sellQty').value);
  const price = parseFloat(document.getElementById('sellPrice').value);
  const customer = document.getElementById('sellCustomer').value;
  const note = document.getElementById('sellNote').value;
  
  if (!tyreId) {
    showToast('Please select a tyre', 'error');
    return;
  }
  
  if (qty <= 0) {
    showToast('Quantity must be greater than 0', 'error');
    return;
  }
  
  const selectedOption = document.getElementById('sellTyreSelect').selectedOptions[0];
  const tyre = JSON.parse(selectedOption.dataset.tyre);
  
  if (qty > tyre.quantity) {
    showToast('Not enough stock available', 'error');
    return;
  }
  
  const result = await window.api.sales.create({
    tyre_id: tyreId,
    qty_sold: qty,
    sale_price: price,
    customer_name: customer,
    note
  });
  
  console.log('Sale API result:', result);
  
  if (result.success) {
    console.log('Sale successful. Updated tyre data:', result.data.tyre);
    showToast(`Sold ${qty} x ${tyre.size} for ${formatCurrency(qty * price)}. Remaining stock: ${result.data.tyre.quantity}`);
    document.getElementById('sellTyreSelect').value = '';
    document.getElementById('tyreDetails').style.display = 'none';
    document.getElementById('sellQty').value = 1;
    document.getElementById('sellPrice').value = '';
    document.getElementById('sellCustomer').value = '';
    document.getElementById('sellNote').value = '';
    document.getElementById('totalAmount').textContent = '0';
    loadSellTyres();
    loadStockTable(); // Refresh stock table to show updated quantities
  } else {
    console.error('Sale failed:', result.error);
    showToast(result.error, 'error');
  }
});

async function loadRecentSales() {
  const result = await window.api.sales.getAll({ limit: 5 });
  if (result.success) {
    const tbody = document.getElementById('recentSalesBody');
    tbody.innerHTML = '';
    
    result.data.slice(0, 5).forEach(sale => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${sale.size}</td>
        <td>${sale.qty_sold}</td>
        <td>${formatCurrency(sale.total_amount)}</td>
        <td>${new Date(sale.sold_at).toLocaleTimeString()}</td>
      `;
      tbody.appendChild(row);
    });
  }
}

// Sales History
async function loadSalesHistory() {
  const result = await window.api.sales.getAll(currentFilters);
  if (result.success) {
    allSales = result.data;
    renderSalesHistory(allSales);
    
    const summaryResult = await window.api.sales.getSummary(currentFilters);
    if (summaryResult.success) {
      document.getElementById('salesSummary').innerHTML = `
        <span>Total Sales: ${formatCurrency(summaryResult.data.totalAmount)}</span>
        <span>Units Sold: ${summaryResult.data.totalUnitsSold}</span>
        <span>Transactions: ${summaryResult.data.count}</span>
      `;
    }
  }
}

function renderSalesHistory(sales) {
  const tbody = document.getElementById('salesHistoryBody');
  tbody.innerHTML = '';
  
  sales.forEach(sale => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${new Date(sale.sold_at).toLocaleString()}</td>
      <td>${sale.size}</td>
      <td>${sale.qty_sold}</td>
      <td>${formatCurrency(sale.sale_price)}</td>
      <td>${formatCurrency(sale.total_amount)}</td>
      <td>${sale.customer_name || '-'}</td>
      <td>${sale.note || '-'}</td>
    `;
    tbody.appendChild(row);
  });
}

document.getElementById('applyFilterBtn').addEventListener('click', () => {
  currentFilters = {
    startDate: document.getElementById('filterStartDate').value || null,
    endDate: document.getElementById('filterEndDate').value || null,
    size: document.getElementById('filterSize').value || null
  };
  loadSalesHistory();
});

document.getElementById('todayFilterBtn').addEventListener('click', () => {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('filterStartDate').value = today;
  document.getElementById('filterEndDate').value = today;
  document.getElementById('filterSize').value = '';
  currentFilters = { startDate: today, endDate: today };
  loadSalesHistory();
});

document.getElementById('monthFilterBtn').addEventListener('click', () => {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
  document.getElementById('filterStartDate').value = firstDay;
  document.getElementById('filterEndDate').value = lastDay;
  document.getElementById('filterSize').value = '';
  currentFilters = { startDate: firstDay, endDate: lastDay };
  loadSalesHistory();
});

// Dashboard
async function loadDashboard() {
  const result = await window.api.dashboard.getSummary();
  if (result.success) {
    const data = result.data;
    
    document.getElementById('dashTotalSizes').textContent = data.totalSizes;
    document.getElementById('dashTotalUnits').textContent = data.totalUnits;
    document.getElementById('dashTotalValue').textContent = formatCurrency(data.totalValue);
    document.getElementById('dashTodaySales').textContent = formatCurrency(data.todaySales);
    document.getElementById('dashMonthSales').textContent = formatCurrency(data.monthSales);
    document.getElementById('dashLowStock').textContent = data.lowStockCount;
    
    // Adjust font size for long numbers
    adjustCardFontSize('dashTotalValue');
    adjustCardFontSize('dashTodaySales');
    adjustCardFontSize('dashMonthSales');
    
    // Low stock alerts
    const lowStockBody = document.getElementById('lowStockBody');
    const noLowStock = document.getElementById('noLowStock');
    
    if (data.lowStockItems.length > 0) {
      noLowStock.style.display = 'none';
      lowStockBody.innerHTML = '';
      data.lowStockItems.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${item.size}</td>
          <td>${item.pattern || '-'}</td>
          <td>${item.quantity}</td>
          <td>${item.min_stock_alert}</td>
        `;
        lowStockBody.appendChild(row);
      });
    } else {
      noLowStock.style.display = 'block';
      lowStockBody.innerHTML = '';
    }
    
    // Top selling sizes
    const topSellingBody = document.getElementById('topSellingBody');
    topSellingBody.innerHTML = '';
    data.topSelling.forEach(item => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${item.size}</td>
        <td>${item.total_sold}</td>
      `;
      topSellingBody.appendChild(row);
    });
  }
}

// Export functionality
document.getElementById('exportStockExcelBtn').addEventListener('click', async () => {
  const result = await window.api.export.stockExcel();
  if (result.success) {
    showToast(`Exported to ${result.path}`);
  } else {
    showToast(result.error, 'error');
  }
});

document.getElementById('exportSalesExcelBtn').addEventListener('click', async () => {
  const result = await window.api.export.salesExcel();
  if (result.success) {
    showToast(`Exported to ${result.path}`);
  } else {
    showToast(result.error, 'error');
  }
});

// Purchase History sub-tab
document.querySelectorAll('.sub-tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.sub-tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    const tabId = btn.dataset.tab;
    
    if (tabId === 'stock-table') {
      document.querySelector('.table-container').style.display = 'block';
      document.getElementById('purchase-history').style.display = 'none';
    } else if (tabId === 'purchase-history') {
      document.querySelector('.table-container').style.display = 'none';
      document.getElementById('purchase-history').style.display = 'block';
      loadPurchaseHistory();
    }
  });
});

async function loadPurchaseHistory() {
  const result = await window.api.purchases.getAll();
  if (result.success) {
    const tbody = document.getElementById('purchaseHistoryBody');
    tbody.innerHTML = '';
    
    result.data.forEach(purchase => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${new Date(purchase.purchased_at).toLocaleDateString()}</td>
        <td>${purchase.size}</td>
        <td>${purchase.pattern || '-'}</td>
        <td>${purchase.qty_added}</td>
        <td>${purchase.cost_price ? formatCurrency(purchase.cost_price) : '-'}</td>
        <td>${purchase.supplier || '-'}</td>
      `;
      tbody.appendChild(row);
    });
  }
}

// Backup functionality
async function loadBackupInfo() {
  const result = await window.api.backup.getInfo();
  if (result.success) {
    document.getElementById('dbPath').textContent = result.data.path;
    document.getElementById('dbSize').textContent = result.data.size;
    document.getElementById('dbModified').textContent = result.data.modified;
  }
}

document.getElementById('backupNowBtn').addEventListener('click', async () => {
  const result = await window.api.backup.create();
  if (result.success) {
    showToast(`Backup created at ${result.path}`);
  } else {
    showToast(result.error, 'error');
  }
});

document.getElementById('restoreBackupBtn').addEventListener('click', async () => {
  if (confirm('This will replace all current data. Are you sure you want to restore from backup?')) {
    const confirmation = prompt('Type "RESTORE" to confirm:');
    if (confirmation === 'RESTORE') {
      const result = await window.api.backup.restore();
      if (result.success) {
        showToast('Database restored successfully. The app will now reload.');
        setTimeout(() => location.reload(), 2000);
      } else {
        showToast(result.error, 'error');
      }
    } else {
      showToast('Restore canceled', 'error');
    }
  }
});

// Initialize
loadDashboard();
