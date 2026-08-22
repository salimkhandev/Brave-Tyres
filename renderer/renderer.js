// UI Renderer Script for Brave Tyres Management

// State management
let tyresData = [];
let selectedTyreForSale = null;

// --- Helper Functions ---

// Formats numbers as Pakistani Rupees
function formatRs(amount) {
  const num = Number(amount) || 0;
  return 'Rs. ' + num.toLocaleString('en-PK');
}

// Formats timestamp into readable date and time string
function formatDate(timestamp) {
  if (!timestamp) return '-';
  const d = new Date(timestamp);
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Displays temporary feedback toast message
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.className = `toast ${type}`;
  setTimeout(() => {
    toast.className = 'toast';
  }, 3500);
}

// --- Navigation & Section Switching ---

document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));

    btn.classList.add('active');
    const targetSection = btn.getAttribute('data-section');
    const sectionEl = document.getElementById(targetSection);
    if (sectionEl) {
      sectionEl.classList.add('active');
    }

    // Trigger data refresh for active section
    switch (targetSection) {
      case 'dashboard':
        loadDashboard();
        break;
      case 'stock':
        loadStockTable();
        break;
      case 'sell':
        loadSellSection();
        break;
      case 'sales-history':
        loadSalesHistory();
        break;
      case 'backup':
        loadBackupInfo();
        break;
    }
  });
});

// Sub-tabs in Stock section (Stock Table vs Purchase History)
document.querySelectorAll('.sub-tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.sub-tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const tabTarget = btn.getAttribute('data-tab');
    if (tabTarget === 'stock-table') {
      document.querySelector('.stock-table-container').style.display = 'block';
      document.getElementById('stockFooter').style.display = 'flex';
      document.getElementById('purchase-history').style.display = 'none';
    } else if (tabTarget === 'purchase-history') {
      document.querySelector('.stock-table-container').style.display = 'none';
      document.getElementById('stockFooter').style.display = 'none';
      document.getElementById('purchase-history').style.display = 'block';
      loadPurchaseHistory();
    }
  });
});

// --- Dashboard Section ---

async function loadDashboard() {
  try {
    const res = await window.api.dashboard.getSummary();
    if (!res.success) {
      showToast(res.error || 'Failed to load dashboard', 'error');
      return;
    }

    const data = res.data;
    document.getElementById('dashTotalSizes').textContent = data.totalSizes || 0;
    document.getElementById('dashTotalUnits').textContent = data.totalUnits || 0;
    document.getElementById('dashTotalValue').textContent = formatRs(data.totalValue);
    document.getElementById('dashTodaySales').textContent = formatRs(data.todaySales);
    document.getElementById('dashMonthSales').textContent = formatRs(data.monthSales);
    document.getElementById('dashLowStock').textContent = data.lowStockCount || 0;

    // Populate low stock table
    const lowStockBody = document.getElementById('lowStockBody');
    const noLowStockDiv = document.getElementById('noLowStock');
    lowStockBody.innerHTML = '';

    if (data.lowStockItems && data.lowStockItems.length > 0) {
      noLowStockDiv.style.display = 'none';
      data.lowStockItems.forEach(item => {
        const tr = document.createElement('tr');
        tr.className = 'low-stock';
        tr.innerHTML = `
          <td>${item.size || '-'}</td>
          <td>${item.pattern || '-'}</td>
          <td><strong>${item.quantity}</strong></td>
          <td>${item.min_stock_alert}</td>
        `;
        lowStockBody.appendChild(tr);
      });
    } else {
      noLowStockDiv.style.display = 'block';
    }

    // Populate top selling table
    const topSellingBody = document.getElementById('topSellingBody');
    topSellingBody.innerHTML = '';
    if (data.topSelling && data.topSelling.length > 0) {
      data.topSelling.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${item.size}</td>
          <td><strong>${item.total_sold}</strong></td>
        `;
        topSellingBody.appendChild(tr);
      });
    } else {
      topSellingBody.innerHTML = `<tr><td colspan="2" class="no-data">No sales recorded this month</td></tr>`;
    }
  } catch (err) {
    console.error('Error loading dashboard:', err);
  }
}

// --- Stock Section ---

async function loadStockTable() {
  try {
    const res = await window.api.tyres.getAll();
    if (!res.success) {
      showToast(res.error || 'Failed to load tyres', 'error');
      return;
    }

    tyresData = res.data || [];
    renderStockRows(tyresData);
  } catch (err) {
    console.error('Error loading stock:', err);
  }
}

function renderStockRows(tyres) {
  const tbody = document.getElementById('stockTableBody');
  tbody.innerHTML = '';

  let totalSizes = tyres.length;
  let totalUnits = 0;
  let totalValue = 0;

  tyres.forEach(tyre => {
    const isLow = tyre.quantity <= tyre.min_stock_alert;
    totalUnits += tyre.quantity;
    const itemTotalValue = tyre.quantity * tyre.set_price;
    totalValue += itemTotalValue;

    const tr = document.createElement('tr');
    if (isLow) tr.className = 'low-stock';

    tr.innerHTML = `
      <td>${tyre.serial_no || '-'}</td>
      <td><strong>${tyre.size}</strong></td>
      <td>${tyre.pr || '-'}</td>
      <td>${tyre.pattern || '-'}</td>
      <td>${tyre.brand || '-'}</td>
      <td><strong>${tyre.quantity}</strong></td>
      <td>${formatRs(tyre.price_with_duty)}</td>
      <td>${formatRs(tyre.set_price)}</td>
      <td>${formatRs(itemTotalValue)}</td>
      <td>
        <button class="btn btn-secondary btn-sm edit-tyre-btn" data-id="${tyre.id}">Edit</button>
        <button class="btn btn-primary btn-sm add-stock-btn" data-id="${tyre.id}">+ Stock</button>
        <button class="btn btn-danger btn-sm delete-tyre-btn" data-id="${tyre.id}">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Update summary footer
  const footer = document.getElementById('stockFooter');
  if (footer) {
    footer.children[0].textContent = `Total Sizes: ${totalSizes}`;
    footer.children[1].textContent = `Total Units in Stock: ${totalUnits}`;
    footer.children[2].textContent = `Total Stock Value: ${formatRs(totalValue)}`;
  }

  // Bind row buttons
  document.querySelectorAll('.edit-tyre-btn').forEach(btn => {
    btn.addEventListener('click', () => openEditModal(btn.getAttribute('data-id')));
  });
  document.querySelectorAll('.add-stock-btn').forEach(btn => {
    btn.addEventListener('click', () => openAddStockModal(btn.getAttribute('data-id')));
  });
  document.querySelectorAll('.delete-tyre-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteTyre(btn.getAttribute('data-id')));
  });
}

// Live stock search filter
document.getElementById('stockSearch')?.addEventListener('input', (e) => {
  const query = e.target.value.toLowerCase().trim();
  if (!query) {
    renderStockRows(tyresData);
    return;
  }
  const filtered = tyresData.filter(t =>
    (t.size && t.size.toLowerCase().includes(query)) ||
    (t.pattern && t.pattern.toLowerCase().includes(query)) ||
    (t.brand && t.brand.toLowerCase().includes(query)) ||
    (t.serial_no && t.serial_no.toLowerCase().includes(query))
  );
  renderStockRows(filtered);
});

// Load purchase history table
async function loadPurchaseHistory() {
  try {
    const res = await window.api.purchases.getAll();
    if (!res.success) return;

    const tbody = document.getElementById('purchaseHistoryBody');
    tbody.innerHTML = '';

    if (res.data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="no-data">No purchase records found</td></tr>`;
      return;
    }

    res.data.forEach(p => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${formatDate(p.purchased_at)}</td>
        <td><strong>${p.size || '-'}</strong></td>
        <td>${p.pattern || '-'}</td>
        <td><strong>+${p.qty_added}</strong></td>
        <td>${p.cost_price ? formatRs(p.cost_price) : '-'}</td>
        <td>${p.supplier || '-'}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error('Error loading purchase history:', err);
  }
}

// --- Add / Edit Tyre Modal ---

const tyreModal = document.getElementById('tyreModal');
const tyreForm = document.getElementById('tyreForm');

document.getElementById('addTyreBtn')?.addEventListener('click', () => {
  tyreForm.reset();
  document.getElementById('tyreId').value = '';
  document.getElementById('modalTitle').textContent = 'Add New Tyre';
  document.getElementById('tyreSerial').value = 'Auto-generated';
  tyreModal.classList.add('active');
});

document.getElementById('closeModal')?.addEventListener('click', () => {
  tyreModal.classList.remove('active');
});

document.getElementById('cancelBtn')?.addEventListener('click', () => {
  tyreModal.classList.remove('active');
});

function openEditModal(id) {
  const tyre = tyresData.find(t => t.id == id);
  if (!tyre) return;

  document.getElementById('tyreId').value = tyre.id;
  document.getElementById('tyreSerial').value = tyre.serial_no || '';
  document.getElementById('tyreSize').value = tyre.size || '';
  document.getElementById('tyrePR').value = tyre.pr || '';
  document.getElementById('tyrePattern').value = tyre.pattern || '';
  document.getElementById('tyreBrand').value = tyre.brand || '';
  document.getElementById('tyreOrigin').value = tyre.origin || '';
  document.getElementById('tyreQty').value = tyre.quantity;
  document.getElementById('tyrePurchasePrice').value = tyre.purchase_price || '';
  document.getElementById('tyrePriceWithDuty').value = tyre.price_with_duty || '';
  document.getElementById('tyreSetPrice').value = tyre.set_price || '';
  document.getElementById('tyreMinStock').value = tyre.min_stock_alert || 2;

  document.getElementById('modalTitle').textContent = 'Edit Tyre';
  tyreModal.classList.add('active');
}

tyreForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('tyreId').value;

  const tyreData = {
    size: document.getElementById('tyreSize').value.trim(),
    pr: document.getElementById('tyrePR').value.trim(),
    pattern: document.getElementById('tyrePattern').value.trim(),
    brand: document.getElementById('tyreBrand').value.trim(),
    origin: document.getElementById('tyreOrigin').value.trim(),
    quantity: parseInt(document.getElementById('tyreQty').value) || 0,
    purchase_price: parseFloat(document.getElementById('tyrePurchasePrice').value) || 0,
    price_with_duty: parseFloat(document.getElementById('tyrePriceWithDuty').value) || 0,
    set_price: parseFloat(document.getElementById('tyreSetPrice').value) || 0,
    min_stock_alert: parseInt(document.getElementById('tyreMinStock').value) || 2
  };

  let res;
  if (id) {
    res = await window.api.tyres.update(parseInt(id), tyreData);
  } else {
    res = await window.api.tyres.create(tyreData);
  }

  if (res.success) {
    showToast(id ? 'Tyre updated successfully' : 'New tyre added successfully');
    tyreModal.classList.remove('active');
    loadStockTable();
  } else {
    showToast(res.error || 'Operation failed', 'error');
  }
});

async function deleteTyre(id) {
  if (!confirm('Are you sure you want to delete this tyre entry?')) return;
  const res = await window.api.tyres.delete(parseInt(id));
  if (res.success) {
    showToast('Tyre deleted');
    loadStockTable();
  } else {
    showToast(res.error || 'Failed to delete tyre', 'error');
  }
}

// --- Quick Add Stock Modal ---

const addStockModal = document.getElementById('addStockModal');
const addStockForm = document.getElementById('addStockForm');

function openAddStockModal(id) {
  addStockForm.reset();
  document.getElementById('addStockTyreId').value = id;
  addStockModal.classList.add('active');
}

document.getElementById('closeAddStockModal')?.addEventListener('click', () => {
  addStockModal.classList.remove('active');
});

document.getElementById('cancelAddStockBtn')?.addEventListener('click', () => {
  addStockModal.classList.remove('active');
});

addStockForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = parseInt(document.getElementById('addStockTyreId').value);
  const qty = parseInt(document.getElementById('addStockQty').value) || 0;
  const cost = parseFloat(document.getElementById('addStockCostPrice').value) || 0;
  const supplier = document.getElementById('addStockSupplier').value.trim();

  const res = await window.api.tyres.addStock(id, qty, cost, supplier);
  if (res.success) {
    showToast(`Added ${qty} units to stock`);
    addStockModal.classList.remove('active');
    loadStockTable();
  } else {
    showToast(res.error || 'Failed to add stock', 'error');
  }
});

// --- Batch Add Stock Modal ---

const batchStockModal = document.getElementById('batchStockModal');
const batchStockBody = document.getElementById('batchStockBody');

document.getElementById('addBatchStockBtn')?.addEventListener('click', () => {
  initBatchRows();
  batchStockModal.classList.add('active');
});

document.getElementById('closeBatchStockModal')?.addEventListener('click', () => {
  batchStockModal.classList.remove('active');
});

function initBatchRows(rowCount = 5) {
  batchStockBody.innerHTML = '';
  for (let i = 0; i < rowCount; i++) {
    addBatchRow();
  }
}

function addBatchRow() {
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input type="text" class="batch-size" placeholder="e.g. 185/70R13"></td>
    <td><input type="text" class="batch-pr" placeholder="6PR"></td>
    <td><input type="text" class="batch-pattern" placeholder="Pattern"></td>
    <td><input type="text" class="batch-brand" placeholder="Brand"></td>
    <td><input type="text" class="batch-origin" placeholder="Origin"></td>
    <td><input type="number" class="batch-qty" min="0" value="0"></td>
    <td><input type="number" class="batch-pprice" min="0" step="0.01"></td>
    <td><input type="number" class="batch-dutyprice" min="0" step="0.01"></td>
    <td><input type="number" class="batch-setprice" min="0" step="0.01"></td>
    <td><input type="number" class="batch-minstock" min="0" value="2"></td>
    <td><button class="btn btn-danger btn-sm remove-batch-row">&times;</button></td>
  `;
  tr.querySelector('.remove-batch-row').addEventListener('click', () => tr.remove());
  batchStockBody.appendChild(tr);
}

document.getElementById('addBatchRowBtn')?.addEventListener('click', () => addBatchRow());
document.getElementById('clearBatchBtn')?.addEventListener('click', () => initBatchRows());

document.getElementById('saveBatchStockBtn')?.addEventListener('click', async () => {
  const rows = batchStockBody.querySelectorAll('tr');
  let savedCount = 0;

  for (const tr of rows) {
    const size = tr.querySelector('.batch-size').value.trim();
    const qty = parseInt(tr.querySelector('.batch-qty').value) || 0;
    const setPrice = parseFloat(tr.querySelector('.batch-setprice').value) || 0;

    if (size && (qty > 0 || setPrice > 0)) {
      const tyreData = {
        size,
        pr: tr.querySelector('.batch-pr').value.trim(),
        pattern: tr.querySelector('.batch-pattern').value.trim(),
        brand: tr.querySelector('.batch-brand').value.trim(),
        origin: tr.querySelector('.batch-origin').value.trim(),
        quantity: qty,
        purchase_price: parseFloat(tr.querySelector('.batch-pprice').value) || 0,
        price_with_duty: parseFloat(tr.querySelector('.batch-dutyprice').value) || 0,
        set_price: setPrice,
        min_stock_alert: parseInt(tr.querySelector('.batch-minstock').value) || 2
      };
      const res = await window.api.tyres.create(tyreData);
      if (res.success) savedCount++;
    }
  }

  if (savedCount > 0) {
    showToast(`Successfully added ${savedCount} new tyre items`);
    batchStockModal.classList.remove('active');
    loadStockTable();
  } else {
    showToast('No valid filled rows found to save', 'error');
  }
});

// --- Sell Flow Section ---

async function loadSellSection() {
  try {
    const res = await window.api.tyres.getAll();
    if (!res.success) return;

    const tyres = res.data || [];
    const select = document.getElementById('sellTyreSelect');
    select.innerHTML = '<option value="">-- Select a tyre --</option>';

    // Filter available stock
    tyres.filter(t => t.quantity > 0).forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = `${t.size} - ${t.pattern || 'Standard'} (Qty: ${t.quantity})`;
      select.appendChild(opt);
    });

    tyresData = tyres;
    document.getElementById('tyreDetails').style.display = 'none';
    document.getElementById('totalAmount').textContent = '0';
    loadRecentSales();
  } catch (err) {
    console.error('Error loading sell section:', err);
  }
}

document.getElementById('sellTyreSelect')?.addEventListener('change', (e) => {
  const id = e.target.value;
  const detailsBox = document.getElementById('tyreDetails');

  if (!id) {
    selectedTyreForSale = null;
    detailsBox.style.display = 'none';
    document.getElementById('totalAmount').textContent = '0';
    return;
  }

  selectedTyreForSale = tyresData.find(t => t.id == id);
  if (selectedTyreForSale) {
    document.getElementById('detailSize').textContent = selectedTyreForSale.size;
    document.getElementById('detailPR').textContent = selectedTyreForSale.pr || '-';
    document.getElementById('detailPattern').textContent = selectedTyreForSale.pattern || '-';
    document.getElementById('detailStock').textContent = `${selectedTyreForSale.quantity} available`;
    document.getElementById('detailPrice').textContent = formatRs(selectedTyreForSale.set_price);

    document.getElementById('sellPrice').value = selectedTyreForSale.set_price || 0;
    document.getElementById('sellQty').max = selectedTyreForSale.quantity;
    document.getElementById('sellQty').value = 1;

    detailsBox.style.display = 'block';
    recalculateTotalAmount();
  }
});

document.getElementById('sellQty')?.addEventListener('input', recalculateTotalAmount);
document.getElementById('sellPrice')?.addEventListener('input', recalculateTotalAmount);

function recalculateTotalAmount() {
  const qty = parseInt(document.getElementById('sellQty').value) || 0;
  const price = parseFloat(document.getElementById('sellPrice').value) || 0;
  const total = qty * price;
  document.getElementById('totalAmount').textContent = total.toLocaleString('en-PK');
}

document.getElementById('confirmSaleBtn')?.addEventListener('click', async () => {
  const select = document.getElementById('sellTyreSelect');
  const tyreId = parseInt(select.value);
  const qty = parseInt(document.getElementById('sellQty').value) || 0;
  const salePrice = parseFloat(document.getElementById('sellPrice').value) || 0;
  const customerName = document.getElementById('sellCustomer').value.trim();
  const note = document.getElementById('sellNote').value.trim();

  if (!tyreId) {
    showToast('Please select a tyre to sell', 'error');
    return;
  }
  if (qty <= 0) {
    showToast('Quantity must be greater than 0', 'error');
    return;
  }
  if (selectedTyreForSale && qty > selectedTyreForSale.quantity) {
    showToast(`Only ${selectedTyreForSale.quantity} units available in stock`, 'error');
    return;
  }

  const saleData = {
    tyre_id: tyreId,
    qty_sold: qty,
    sale_price: salePrice,
    customer_name: customerName,
    note: note
  };

  const res = await window.api.sales.create(saleData);
  if (res.success) {
    showToast('Sale completed successfully!');
    document.getElementById('sellCustomer').value = '';
    document.getElementById('sellNote').value = '';
    loadSellSection();
  } else {
    showToast(res.error || 'Sale failed', 'error');
  }
});

async function loadRecentSales() {
  try {
    const res = await window.api.sales.getAll({ limit: 5 });
    if (!res.success) return;

    const tbody = document.getElementById('recentSalesBody');
    tbody.innerHTML = '';

    if (res.data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="no-data">No sales recorded yet</td></tr>`;
      return;
    }

    res.data.forEach(s => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${s.size}</strong></td>
        <td>${s.qty_sold}</td>
        <td>${formatRs(s.total_amount)}</td>
        <td>${formatDate(s.sold_at)}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error('Error loading recent sales:', err);
  }
}

// --- Sales History Section ---

async function loadSalesHistory(filters = {}) {
  try {
    const res = await window.api.sales.getAll(filters);
    const summaryRes = await window.api.sales.getSummary(filters);

    if (summaryRes.success) {
      const sum = summaryRes.data;
      const summaryBar = document.getElementById('salesSummary');
      if (summaryBar) {
        summaryBar.children[0].textContent = `Total Sales: ${formatRs(sum.totalAmount)}`;
        summaryBar.children[1].textContent = `Units Sold: ${sum.totalUnitsSold}`;
        summaryBar.children[2].textContent = `Transactions: ${sum.count}`;
      }
    }

    const tbody = document.getElementById('salesHistoryBody');
    tbody.innerHTML = '';

    if (!res.success || res.data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="no-data">No sales matching filter criteria</td></tr>`;
      return;
    }

    res.data.forEach(s => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${formatDate(s.sold_at)}</td>
        <td><strong>${s.size}</strong></td>
        <td>${s.qty_sold}</td>
        <td>${formatRs(s.sale_price)}</td>
        <td><strong>${formatRs(s.total_amount)}</strong></td>
        <td>${s.customer_name || '-'}</td>
        <td>${s.note || '-'}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error('Error loading sales history:', err);
  }
}

// Apply filter button
document.getElementById('applyFilterBtn')?.addEventListener('click', () => {
  const startDate = document.getElementById('filterStartDate').value;
  const endDate = document.getElementById('filterEndDate').value;
  const size = document.getElementById('filterSize').value.trim();

  loadSalesHistory({ startDate, endDate, size });
});

// Quick filter: Today
document.getElementById('todayFilterBtn')?.addEventListener('click', () => {
  const todayStr = new Date().toISOString().split('T')[0];
  document.getElementById('filterStartDate').value = todayStr;
  document.getElementById('filterEndDate').value = todayStr;
  loadSalesHistory({ startDate: todayStr, endDate: todayStr });
});

// Quick filter: This Month
document.getElementById('monthFilterBtn')?.addEventListener('click', () => {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const todayStr = now.toISOString().split('T')[0];

  document.getElementById('filterStartDate').value = monthStart;
  document.getElementById('filterEndDate').value = todayStr;
  loadSalesHistory({ startDate: monthStart, endDate: todayStr });
});

// --- Backup & Restore Section ---

async function loadBackupInfo() {
  try {
    const res = await window.api.backup.getInfo();
    if (res.success) {
      document.getElementById('dbPath').textContent = res.data.path;
      document.getElementById('dbSize').textContent = res.data.size;
      document.getElementById('dbModified').textContent = res.data.modified;
    }
  } catch (err) {
    console.error('Error loading backup info:', err);
  }
}

document.getElementById('backupNowBtn')?.addEventListener('click', async () => {
  const res = await window.api.backup.create();
  if (res.success) {
    showToast(`Backup created successfully at ${res.path}`);
    loadBackupInfo();
  } else if (res.error !== 'Backup canceled') {
    showToast(res.error || 'Backup failed', 'error');
  }
});

document.getElementById('restoreBackupBtn')?.addEventListener('click', async () => {
  if (!confirm('WARNING: Restoring will overwrite current database data. Are you sure you want to proceed?')) {
    return;
  }
  const res = await window.api.backup.restore();
  if (res.success) {
    showToast('Database restored successfully! Reloading...');
    setTimeout(() => {
      loadDashboard();
    }, 1500);
  } else if (res.error !== 'Restore canceled') {
    showToast(res.error || 'Restore failed', 'error');
  }
});

// --- Export Features ---

document.getElementById('exportStockExcelBtn')?.addEventListener('click', async () => {
  const res = await window.api.export.stockExcel();
  if (res.success) {
    showToast(`Exported stock report to ${res.path}`);
  } else if (res.error !== 'Export canceled') {
    showToast(res.error || 'Stock export failed', 'error');
  }
});

document.getElementById('exportSalesExcelBtn')?.addEventListener('click', async () => {
  const res = await window.api.export.salesExcel();
  if (res.success) {
    showToast(`Exported sales report to ${res.path}`);
  } else if (res.error !== 'Export canceled') {
    showToast(res.error || 'Sales export failed', 'error');
  }
});

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  loadDashboard();
});
