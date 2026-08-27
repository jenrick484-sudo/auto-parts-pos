/* GLOBAL SYSTEM STATE */
let loggedInUser = JSON.parse(localStorage.getItem('pos_user')) || null;
let cart = [];
let salesChartInstance = null;
let brandChartInstance = null;

let activeReportLevel = 'yearly';
let currentSelectedYear = "2026";
let currentSelectedMonth = "08";
let currentSelectedDate = getTodayString();

const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

let html5QrCode = null;
let isCameraActive = false;
let lastScannedCode = "";
let lastScanTime = 0;

/* UTILITY FUNCTIONS */
function toUpper(val) {
  return val ? val.toString().trim().toUpperCase() : '';
}

function getTodayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// AUTO INIT ON LOAD
window.addEventListener('DOMContentLoaded', () => {
  if (loggedInUser) {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('activeUserFullName').textContent = loggedInUser.fullName;
    document.getElementById('activeUserRoleBadge').textContent = loggedInUser.role;
    applyUserRoleRestrictions();
    switchView('view-dashboard', document.querySelectorAll('.nav-item')[0]);
  } else {
    document.getElementById('loginScreen').style.display = 'flex';
  }
  document.getElementById('salesDateFilter').value = getTodayString();
});

/* AUTHENTICATION LOGIC */
async function handleLoginSubmit(event) {
  event.preventDefault();
  const username = document.getElementById('loginUsernameInput').value.trim();
  const password = document.getElementById('loginPasswordInput').value;

  try {
    const res = await apiRequest('/auth/login', 'POST', { username, password });
    
    localStorage.setItem('pos_token', res.token);
    localStorage.setItem('pos_user', JSON.stringify(res.user));
    loggedInUser = res.user;

    document.getElementById('loginErrorMsg').style.display = 'none';
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('loginForm').reset();

    document.getElementById('activeUserFullName').textContent = loggedInUser.fullName;
    document.getElementById('activeUserRoleBadge').textContent = loggedInUser.role;

    applyUserRoleRestrictions();
    switchView('view-dashboard', document.querySelectorAll('.nav-item')[0]);
  } catch (err) {
    document.getElementById('loginErrorMsg').textContent = `❌ ${err.message}`;
    document.getElementById('loginErrorMsg').style.display = 'block';
  }
}

function handleLogout() {
  if (confirm('Sigurado ka bang gusto mong mag-logout?')) {
    localStorage.removeItem('pos_token');
    localStorage.removeItem('pos_user');
    loggedInUser = null;
    stopCameraScanner();
    document.getElementById('loginScreen').style.display = 'flex';
  }
}

function applyUserRoleRestrictions() {
  const navItems = document.querySelectorAll('.nav-item');
  if (!loggedInUser) return;

  if (loggedInUser.role === 'CASHIER') {
    navItems.forEach((item, idx) => {
      item.style.display = idx === 1 ? 'flex' : 'none';
    });
    switchView('view-sale', navItems[1]);
  } else if (loggedInUser.role === 'MANAGER') {
    navItems.forEach((item, idx) => {
      item.style.display = idx === 6 ? 'none' : 'flex';
    });
  } else {
    navItems.forEach(item => item.style.display = 'flex');
  }
}

/* NAVIGATION VIEW SWITCHER */
function switchView(viewId, element) {
  document.querySelectorAll('.view-content').forEach(view => view.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));

  document.getElementById(viewId).classList.add('active');
  if (element) element.classList.add('active');

  const titles = {
    'view-dashboard': 'Executive Overview Dashboard',
    'view-sale': 'Point of Sale / Checkout Module',
    'view-sales-log': 'Daily Sales & Receipts Log',
    'view-reports': 'Financial & Performance Reports',
    'view-master': 'Master Item Management',
    'view-inventory': 'Central Inventory',
    'view-users': 'User Management & Accounts'
  };
  document.getElementById('pageTitle').textContent = titles[viewId] || 'Dashboard';

  if (viewId === 'view-dashboard') renderDashboard();
  if (viewId === 'view-sale') { 
    renderSaleGrid(); 
    document.getElementById('saleSearchInput').focus(); 
  } else {
    stopCameraScanner();
  }
  if (viewId === 'view-sales-log') renderSalesLog();
  if (viewId === 'view-reports') renderReportsModule();
  if (viewId === 'view-master') renderStep1Grid();
  if (viewId === 'view-inventory') renderInventoryGrid();
  if (viewId === 'view-users') renderUsersTable();
}

/* DASHBOARD MODULE */
async function renderDashboard() {
  try {
    const variants = await apiRequest('/variants');
    const masters = await apiRequest('/masters');
    const todayStr = getTodayString();
    const reports = await apiRequest(`/reports/summary?date=${todayStr}`);

    const todayReport = reports[0] || { gross_sales: 0, net_profit: 0, total_txns: 0 };

    document.getElementById('dashTodaySales').textContent = `₱${parseFloat(todayReport.gross_sales).toLocaleString('en-US', {minimumFractionDigits: 2})}`;
    document.getElementById('dashTodayProfit').textContent = `₱${parseFloat(todayReport.net_profit).toLocaleString('en-US', {minimumFractionDigits: 2})}`;
    document.getElementById('dashTodayTxns').textContent = `${todayReport.total_txns} Transaction(s) Today`;

    const outOfStockList = variants.filter(b => parseInt(b.stock) === 0);
    const lowStockList = variants.filter(b => parseInt(b.stock) > 0 && parseInt(b.stock) <= parseInt(b.low_stock_limit));
    const totalAlerts = outOfStockList.length + lowStockList.length;

    document.getElementById('dashLowStockCount').textContent = `${totalAlerts} Alert(s)`;
    document.getElementById('dashOutStockSub').textContent = `${outOfStockList.length} Out of Stock | ${lowStockList.length} Low Stock`;

    const assetValuation = variants.reduce((sum, b) => sum + (parseFloat(b.cost) * parseInt(b.stock)), 0);
    document.getElementById('dashAssetValuation').textContent = `₱${assetValuation.toLocaleString('en-US', {minimumFractionDigits: 2})}`;
    document.getElementById('dashTotalItemsCount').textContent = `${masters.length} Masters | ${variants.length} Variants`;

    // CRITICAL REORDER TABLE
    const reorderBody = document.getElementById('dashReorderTableBody');
    reorderBody.innerHTML = '';
    const criticalVariants = [...outOfStockList, ...lowStockList].slice(0, 5);

    if (criticalVariants.length === 0) {
      reorderBody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#16a34a; padding:16px;">✅ All items have healthy stock levels!</td></tr>`;
    } else {
      criticalVariants.forEach(b => {
        const badgeClass = parseInt(b.stock) === 0 ? 'stock-red' : 'stock-orange';
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong>${b.code}</strong></td>
          <td>${b.part_name} (${b.oem})</td>
          <td style="text-align:center;"><span class="stock-badge ${badgeClass}">${b.stock}</span></td>
          <td style="text-align:center;">
            <button class="btn btn-primary" style="font-size:10px; padding:2px 6px;" onclick="openRestockModal('${b.code}')">➕ Restock</button>
          </td>
        `;
        reorderBody.appendChild(tr);
      });
    }

    renderDashboardCharts();
  } catch (err) {
    console.error("Dashboard Load Error:", err);
  }
}

function renderDashboardCharts() {
  const ctxSales = document.getElementById('salesTrendChart').getContext('2d');
  if (salesChartInstance) salesChartInstance.destroy();

  salesChartInstance = new Chart(ctxSales, {
    type: 'line',
    data: {
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      datasets: [{
        label: 'Daily Sales (₱)',
        data: [1200, 1900, 3000, 5200, 2300, 4100, 3400],
        borderColor: '#2563eb',
        backgroundColor: 'rgba(37, 99, 235, 0.08)',
        fill: true,
        tension: 0.3,
        borderWidth: 2
      }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
  });

  const ctxBrand = document.getElementById('brandShareChart').getContext('2d');
  if (brandChartInstance) brandChartInstance.destroy();

  brandChartInstance = new Chart(ctxBrand, {
    type: 'doughnut',
    data: {
      labels: ['Toyota Genuine', 'Akebono', 'Vic Filters', 'Bosch'],
      datasets: [{
        data: [45, 25, 20, 10],
        backgroundColor: ['#2563eb', '#16a34a', '#ea580c', '#64748b']
      }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
  });
}

/* POS SALE & CATALOG MODULE */
async function renderSaleGrid() {
  const grid = document.getElementById('saleCatalogGrid');
  const search = document.getElementById('saleSearchInput').value.trim().toUpperCase();

  try {
    const variants = await apiRequest('/variants');
    grid.innerHTML = '';

    const filtered = variants.filter(b => 
      b.code.toUpperCase().includes(search) ||
      b.barcode.toUpperCase().includes(search) ||
      b.part_name.toUpperCase().includes(search) ||
      b.oem.toUpperCase().includes(search) ||
      b.brand.toUpperCase().includes(search)
    );

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div class="empty-stock-banner" style="border-color:#cbd5e1; background:#ffffff;">
          <div class="empty-stock-icon" style="background-color:#f1f5f9; color:#64748b;">🔍</div>
          <div class="empty-stock-title" style="color:#0f172a;">NO MATCHING VARIANTS FOUND</div>
        </div>`;
      return;
    }

    filtered.forEach(batch => {
      const card = document.createElement('div');
      card.className = 'item-card';
      card.onclick = () => addToCart(batch);

      const badgeClass = parseInt(batch.stock) > 0 ? 'stock-green' : 'stock-red';

      card.innerHTML = `
        <div>
          <div class="card-img-placeholder">⚙️</div>
          <div class="item-title">${batch.part_name} - ${batch.oem}</div>
          <div class="item-oem">${batch.brand} | SUPPLIER: ${batch.supplier}</div>
          <div class="item-subtitle">VARIANT: ${batch.code}</div>
        </div>
        <div class="card-footer">
          <div class="item-price">₱${parseFloat(batch.price).toFixed(2)}</div>
          <span class="stock-badge ${badgeClass}">${parseInt(batch.stock) === 0 ? '0 OUT OF STOCK' : 'STOCK: ' + batch.stock}</span>
        </div>
      `;
      grid.appendChild(card);
    });
  } catch (err) {
    grid.innerHTML = `<p style="color:red; padding:10px;">Failed to load catalog: ${err.message}</p>`;
  }
}

function addToCart(batch) {
  if (parseInt(batch.stock) <= 0) {
    alert('Out of stock na ang variant item na ito!');
    return;
  }

  const existing = cart.find(i => i.batchCode === batch.code);
  if (existing) {
    if (existing.qty + 1 > parseInt(batch.stock)) {
      alert(`Hindi pwedeng lumagpas sa available stock (${batch.stock})!`);
      return;
    }
    existing.qty += 1;
  } else {
    cart.push({
      batchCode: batch.code,
      partName: batch.part_name,
      oem: batch.oem,
      brand: batch.brand,
      price: parseFloat(batch.price),
      cost: parseFloat(batch.cost),
      qty: 1,
      maxStock: parseInt(batch.stock)
    });
  }
  updateCartUI();
}

function updateCartQty(batchCode, delta) {
  const item = cart.find(i => i.batchCode === batchCode);
  if (!item) return;

  const newQty = item.qty + delta;
  if (newQty > item.maxStock) {
    alert(`Maximum available stock is ${item.maxStock}`);
    return;
  }

  if (newQty <= 0) {
    cart = cart.filter(i => i.batchCode !== batchCode);
  } else {
    item.qty = newQty;
  }
  updateCartUI();
}

function clearCart() {
  cart = [];
  updateCartUI();
}

function updateCartUI() {
  const tbody = document.getElementById('cartTableBody');
  tbody.innerHTML = '';

  let totalItems = 0;
  let grandTotal = 0;

  if (cart.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#94a3b8; padding:20px;">Cart is empty. Scan or search a variant item.</td></tr>`;
  } else {
    cart.forEach(item => {
      const itemTotal = item.price * item.qty;
      totalItems += item.qty;
      grandTotal += itemTotal;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <strong>${item.partName}</strong><br>
          <small style="color:#64748b;">${item.batchCode}</small>
        </td>
        <td style="text-align:center;">
          <button class="cart-qty-btn" onclick="updateCartQty('${item.batchCode}', -1)">-</button>
          <span style="margin: 0 4px; font-weight:bold;">${item.qty}</span>
          <button class="cart-qty-btn" onclick="updateCartQty('${item.batchCode}', 1)">+</button>
        </td>
        <td style="text-align:right;">₱${item.price.toFixed(2)}</td>
        <td style="text-align:right; font-weight:bold;">₱${itemTotal.toFixed(2)}</td>
        <td style="text-align:center;">
          <button class="btn btn-danger" style="font-size:10px; padding:2px 6px;" onclick="updateCartQty('${item.batchCode}', -${item.qty})">&times;</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  document.getElementById('cartTotalItems').textContent = totalItems;
  document.getElementById('cartGrandTotal').textContent = `₱${grandTotal.toFixed(2)}`;
  calculateChange();
}

function calculateChange() {
  const cash = parseFloat(document.getElementById('cashTenderedInput').value) || 0;
  const grandTotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const change = cash - grandTotal;
  document.getElementById('cartChangeAmount').textContent = `₱${change >= 0 ? change.toFixed(2) : '0.00'}`;
}

async function processCheckout() {
  if (cart.length === 0) return alert('Walang laman ang Cart!');

  const grandTotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const totalCost = cart.reduce((sum, item) => sum + (item.cost * item.qty), 0);
  const cash = parseFloat(document.getElementById('cashTenderedInput').value) || 0;

  if (cash < grandTotal) return alert('Kulang ang ibinayad na Cash!');

  try {
    const payload = { cart, cash, grandTotal, totalCost, change: cash - grandTotal };
    const res = await apiRequest('/sales/checkout', 'POST', payload);

    alert(`✅ Transaction Complete!\nTxn No: ${res.txnNumber}\nTotal: ₱${grandTotal.toFixed(2)}\nChange: ₱${res.change.toFixed(2)}`);

    clearCart();
    document.getElementById('cashTenderedInput').value = '';
    renderSaleGrid();
  } catch (err) {
    alert(`❌ Checkout Failed: ${err.message}`);
  }
}

/* CENTRAL INVENTORY MODULE */
async function renderInventoryGrid() {
  const container = document.getElementById('inventoryRowContainer');
  const search = document.getElementById('inventorySearch').value.toUpperCase();
  container.innerHTML = '';

  try {
    const masters = await apiRequest('/masters');
    const variants = await apiRequest('/variants');

    masters.forEach((master, mIdx) => {
      const batches = variants.filter(b => b.master_id === master.id);
      const totalStock = batches.reduce((sum, b) => sum + parseInt(b.stock), 0);

      const matchesMaster = master.oem.toUpperCase().includes(search) ||
                            master.part_name.toUpperCase().includes(search) ||
                            master.brand.toUpperCase().includes(search);

      if (matchesMaster || batches.some(b => b.code.toUpperCase().includes(search))) {
        const rowCard = document.createElement('div');
        rowCard.className = 'master-row-card';

        rowCard.innerHTML = `
          <div class="master-row-header">
            <div class="master-row-left" onclick="toggleInventoryBatchPanel('batchPanel_${mIdx}')">
              <div class="master-row-thumb">⚙️</div>
              <div>
                <div class="master-row-title">${master.part_name} - ${master.oem}</div>
                <div class="master-row-sub">${master.brand} | VEHICLE : ${master.make || ''} ${master.model || ''}</div>
              </div>
            </div>
            <div class="master-row-actions">
              <button class="btn btn-secondary" style="font-size:11px; padding:6px 12px;" onclick="openQuickCodingModal(${master.id})">➕ New Variant / Coding</button>
              <div style="text-align:right; cursor:pointer;" onclick="toggleInventoryBatchPanel('batchPanel_${mIdx}')">
                <span class="stock-badge ${totalStock > 0 ? 'stock-green' : 'stock-red'}">STOCK: ${totalStock}</span>
                <div style="font-size:11px; font-weight:700; color:#2563eb; margin-top:4px;">${batches.length} VARIANT(S) ▼</div>
              </div>
            </div>
          </div>
          
          <div id="batchPanel_${mIdx}" class="batch-expand-panel" style="display: none;">
            <div class="batch-panel-title">🏷️ ASSOCIATED VARIANT CODING & SCANNABLE BARCODES</div>
            <div id="batchGrid_${mIdx}" class="catalog-grid" style="margin-top:12px;"></div>
          </div>
        `;

        container.appendChild(rowCard);

        const batchGrid = rowCard.querySelector(`#batchGrid_${mIdx}`);
        batches.forEach((batch, bIdx) => {
          const bCard = document.createElement('div');
          bCard.className = 'item-card';
          const svgId = `inventorySvg_${mIdx}_${bIdx}`;

          bCard.innerHTML = `
            <div>
              <div class="item-title" style="color:#2563eb;">${batch.code}</div>
              <div class="item-subtitle" style="margin-bottom:6px;">SUPPLIER: ${batch.supplier}</div>
              <div class="barcode-card-box">
                <svg id="${svgId}" class="barcode-svg"></svg>
              </div>
            </div>
            <div class="card-footer">
              <div>
                <div class="item-price">₱${parseFloat(batch.price).toFixed(2)}</div>
                <div style="font-size:10px; color:#64748b;">COST: ₱${parseFloat(batch.cost).toFixed(2)}</div>
              </div>
              <div style="text-align:right;">
                <span class="stock-badge ${parseInt(batch.stock) > 0 ? 'stock-green' : 'stock-red'}">STOCK: ${batch.stock}</span>
                <div style="margin-top:6px;">
                  <button class="btn btn-primary" style="font-size:10px; padding:3px 8px;" onclick="openRestockModal('${batch.code}')">➕ Add Stock</button>
                </div>
              </div>
            </div>
          `;
          batchGrid.appendChild(bCard);

          setTimeout(() => {
            if (document.getElementById(svgId)) {
              JsBarcode(`#${svgId}`, batch.barcode, { format: "CODE128", width: 1.4, height: 26, fontSize: 10 });
            }
          }, 40);
        });
      }
    });
  } catch (err) {
    container.innerHTML = `<p style="color:red; padding:10px;">Failed to load inventory: ${err.message}</p>`;
  }
}

function toggleInventoryBatchPanel(panelId) {
  const panel = document.getElementById(panelId);
  if (panel) panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

/* USER MANAGEMENT MODULE */
async function renderUsersTable() {
  const tbody = document.getElementById('usersTableBody');
  tbody.innerHTML = '';

  try {
    const users = await apiRequest('/users');
    users.forEach(u => {
      const tr = document.createElement('tr');
      const rolePillClass = u.role === 'ADMIN' ? 'stock-red' : (u.role === 'MANAGER' ? 'stock-green' : 'stock-orange');

      tr.innerHTML = `
        <td><strong>#USR-${String(u.id).padStart(3, '0')}</strong></td>
        <td><strong>${u.full_name}</strong></td>
        <td><code>${u.username}</code></td>
        <td style="text-align:center;"><span class="stock-badge ${rolePillClass}">${u.role}</span></td>
        <td style="text-align:center;">
          ${u.role === 'ADMIN' ? `<small style="color:#94a3b8;">Protected Account</small>` : 
          `<button class="btn btn-danger" style="font-size:10px; padding:3px 8px;" onclick="deleteSystemUser(${u.id})">🗑️ Delete</button>`}
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" style="color:red; text-align:center;">Failed to load users: ${err.message}</td></tr>`;
  }
}

async function handleRegisterUserSubmit(event) {
  event.preventDefault();
  const fullName = document.getElementById('userFullNameInput').value;
  const username = document.getElementById('userUsernameInput').value;
  const password = document.getElementById('userPasswordInput').value;
  const role = document.getElementById('userRoleSelect').value;

  try {
    await apiRequest('/users', 'POST', { fullName, username, password, role });
    alert(`✅ Bagong account para kay ${fullName} ay matagumpay na nairehistro!`);
    document.getElementById('userRegForm').reset();
    renderUsersTable();
  } catch (err) {
    alert(`❌ Registration Failed: ${err.message}`);
  }
}

async function deleteSystemUser(userId) {
  if (confirm('Sigurado ka bang gusto mong burahin ang account na ito?')) {
    try {
      await apiRequest(`/users/${userId}`, 'DELETE');
      renderUsersTable();
    } catch (err) {
      alert(`❌ Failed to delete user: ${err.message}`);
    }
  }
}

/* MODAL CONTROL HANDLERS */
function openRestockModal(batchCode) {
  document.getElementById('restockBatchCodeInput').value = batchCode;
  document.getElementById('restockBatchSub').textContent = `VARIANT: ${batchCode}`;
  document.getElementById('restockModal').style.display = 'flex';
}

function closeRestockModal() {
  document.getElementById('restockModal').style.display = 'none';
  document.getElementById('restockForm').reset();
}

function closeRestockOnOverlay(e) {
  if (e.target.id === 'restockModal') closeRestockModal();
}

document.getElementById('restockForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  const code = document.getElementById('restockBatchCodeInput').value;
  const addQty = parseInt(document.getElementById('restockAddQty').value) || 0;

  try {
    await apiRequest(`/variants/${code}/restock`, 'PATCH', { addQty });
    closeRestockModal();
    renderDashboard();
    renderInventoryGrid();
    renderSaleGrid();
    alert(`Successfully added +${addQty} stock to ${code}!`);
  } catch (err) {
    alert(`❌ Restock Failed: ${err.message}`);
  }
});

function openQuickCodingModal(masterId) {
  document.getElementById('quickMasterIdInput').value = masterId;
  document.getElementById('quickCodingMasterSub').textContent = `MASTER ITEM ID: ${masterId}`;
  document.getElementById('quickCodingModal').style.display = 'flex';
}

function closeQuickCodingModal() {
  document.getElementById('quickCodingModal').style.display = 'none';
  document.getElementById('quickCodingForm').reset();
}

function closeQuickCodingOnOverlay(e) {
  if (e.target.id === 'quickCodingModal') closeQuickCodingModal();
}

document.getElementById('quickCodingForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  const masterId = parseInt(document.getElementById('quickMasterIdInput').value);
  const supplier = document.getElementById('qSupplierInput').value;
  const cost = parseFloat(document.getElementById('qCostInput').value);
  const price = parseFloat(document.getElementById('qSellingInput').value);
  const stock = parseInt(document.getElementById('qStockInput').value);
  const lowStockLimit = parseInt(document.getElementById('qLowStockInput').value) || 2;

  try {
    await apiRequest('/variants', 'POST', { masterId, supplier, cost, price, stock, lowStockLimit });
    closeQuickCodingModal();
    renderInventoryGrid();
    renderSaleGrid();
    alert('Bagong Supplier Variant ay matagumpay na naisave!');
  } catch (err) {
    alert(`❌ Failed to create variant: ${err.message}`);
  }
});

/* MASTER ITEM FORM SUBMISSION */
document.getElementById('masterForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  const oem = document.getElementById('oemInput').value;
  const brand = document.getElementById('brandInput').value;
  const partName = document.getElementById('partNameInput').value;
  const make = document.getElementById('vehicleMakeInput').value;
  const model = document.getElementById('vehicleModelInput').value;
  const year = document.getElementById('yearInput').value;
  const engine = document.getElementById('engineInput').value;
  const unitType = document.getElementById('unitInput').value;

  try {
    await apiRequest('/masters', 'POST', { oem, brand, partName, make, model, year, engine, unitType });
    alert('Master Item successfully registered!');
    this.reset();
    renderStep1Grid();
  } catch (err) {
    alert(`❌ Save Failed: ${err.message}`);
  }
});

async function renderStep1Grid() {
  const grid = document.getElementById('step1Grid');
  const search = document.getElementById('step1Search').value.toUpperCase();
  
  try {
    const masters = await apiRequest('/masters');
    grid.innerHTML = '';

    const filtered = masters.filter(item => 
      item.oem.toUpperCase().includes(search) ||
      item.part_name.toUpperCase().includes(search) ||
      item.brand.toUpperCase().includes(search)
    );

    filtered.forEach(item => {
      const card = document.createElement('div');
      card.className = 'item-card';
      card.innerHTML = `
        <div>
          <div class="card-img-placeholder">⚙️</div>
          <div class="item-title">${item.part_name} - ${item.oem}</div>
          <div class="item-oem">${item.brand} | VEHICLE : ${item.make || ''} ${item.model || ''}</div>
        </div>
      `;
      grid.appendChild(card);
    });
  } catch (err) {
    grid.innerHTML = `<p style="color:red; padding:10px;">Failed to load catalog: ${err.message}</p>`;
  }
}