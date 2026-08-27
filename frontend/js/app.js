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

// INITIALIZATION ON LOAD
window.addEventListener('DOMContentLoaded', () => {
  if (loggedInUser) {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('activeUserFullName').textContent = loggedInUser.fullName || loggedInUser.username;
    document.getElementById('activeUserRoleBadge').textContent = loggedInUser.role;
    applyUserRoleRestrictions();
    switchView('view-dashboard', document.querySelectorAll('.nav-item')[0]);
  } else {
    document.getElementById('loginScreen').style.display = 'flex';
  }
  const dateFilter = document.getElementById('salesDateFilter');
  if (dateFilter) dateFilter.value = getTodayString();
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
    const errBox = document.getElementById('loginErrorMsg');
    errBox.textContent = `❌ ${err.message}`;
    errBox.style.display = 'block';
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

  const targetView = document.getElementById(viewId);
  if (targetView) targetView.classList.add('active');
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
  const titleEl = document.getElementById('pageTitle');
  if (titleEl) titleEl.textContent = titles[viewId] || 'Dashboard';

  stopCameraScanner();

  if (viewId === 'view-dashboard') renderDashboard();
  if (viewId === 'view-sale') { 
    renderSaleGrid(); 
    const searchInput = document.getElementById('saleSearchInput');
    if (searchInput) searchInput.focus(); 
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
    const variants = await apiRequest('/variants') || [];
    const masters = await apiRequest('/masters') || [];
    const todayStr = getTodayString();
    const reports = await apiRequest(`/reports/summary?date=${todayStr}`) || [];

    const todayReport = reports[0] || { gross_sales: 0, net_profit: 0, total_txns: 0 };

    document.getElementById('dashTodaySales').textContent = `₱${parseFloat(todayReport.gross_sales || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}`;
    document.getElementById('dashTodayProfit').textContent = `₱${parseFloat(todayReport.net_profit || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}`;
    document.getElementById('dashTodayTxns').textContent = `${todayReport.total_txns || 0} Transaction(s) Today`;

    const outOfStockList = variants.filter(b => parseInt(b.stock) === 0);
    const lowStockList = variants.filter(b => parseInt(b.stock) > 0 && parseInt(b.stock) <= parseInt(b.low_stock_limit));
    const totalAlerts = outOfStockList.length + lowStockList.length;

    document.getElementById('dashLowStockCount').textContent = `${totalAlerts} Alert(s)`;
    document.getElementById('dashOutStockSub').textContent = `${outOfStockList.length} Out of Stock | ${lowStockList.length} Low Stock`;

    const assetValuation = variants.reduce((sum, b) => sum + (parseFloat(b.cost || 0) * parseInt(b.stock || 0)), 0);
    document.getElementById('dashAssetValuation').textContent = `₱${assetValuation.toLocaleString('en-US', {minimumFractionDigits: 2})}`;
    document.getElementById('dashTotalItemsCount').textContent = `${masters.length} Masters | ${variants.length} Variants`;

    // CRITICAL REORDER TABLE
    const reorderBody = document.getElementById('dashReorderTableBody');
    if (reorderBody) {
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
            <td>${b.part_name || 'ITEM'} (${b.oem || ''})</td>
            <td style="text-align:center;"><span class="stock-badge ${badgeClass}">${b.stock}</span></td>
            <td style="text-align:center;">
              <button class="btn btn-primary" style="font-size:10px; padding:2px 6px;" onclick="openRestockModal('${b.code}')">➕ Restock</button>
            </td>
          `;
          reorderBody.appendChild(tr);
        });
      }
    }

    renderDashboardCharts();
  } catch (err) {
    console.error("Dashboard Load Error:", err);
  }
}

function renderDashboardCharts() {
  const salesCanvas = document.getElementById('salesTrendChart');
  if (salesCanvas) {
    const ctxSales = salesCanvas.getContext('2d');
    if (salesChartInstance) salesChartInstance.destroy();

    salesChartInstance = new Chart(ctxSales, {
      type: 'line',
      data: {
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        datasets: [{
          label: 'Daily Sales (₱)',
          data: [0, 0, 0, 0, 0, 0, 0],
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37, 99, 235, 0.08)',
          fill: true,
          tension: 0.3,
          borderWidth: 2
        }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });
  }

  const brandCanvas = document.getElementById('brandShareChart');
  if (brandCanvas) {
    const ctxBrand = brandCanvas.getContext('2d');
    if (brandChartInstance) brandChartInstance.destroy();

    brandChartInstance = new Chart(ctxBrand, {
      type: 'doughnut',
      data: {
        labels: ['No Sales Data Yet'],
        datasets: [{
          data: [100],
          backgroundColor: ['#cbd5e1']
        }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
    });
  }
}

/* CAMERA SCANNER LOGIC */
function toggleCameraScanner() {
  if (isCameraActive) {
    stopCameraScanner();
  } else {
    startCameraScanner();
  }
}

function startCameraScanner() {
  const wrapper = document.getElementById('interactive-camera-wrapper');
  const btn = document.getElementById('camToggleBtn');

  if (wrapper) wrapper.style.display = 'block';
  if (typeof Html5Qrcode === 'undefined') {
    alert('Barcode scanner library not loaded.');
    return;
  }
  html5QrCode = new Html5Qrcode("reader");

  const config = { fps: 10, qrbox: { width: 250, height: 150 } };

  html5QrCode.start(
    { facingMode: "environment" },
    config,
    (decodedText) => {
      handleCameraScanSuccess(decodedText);
    }
  ).then(() => {
    isCameraActive = true;
    if (btn) {
      btn.textContent = '🛑 Stop Camera Scanner';
      btn.className = 'btn btn-danger';
    }
  }).catch(err => {
    alert("Hindi mabuksan ang Camera: Siguraduhing pinayagan ang camera permission.");
    if (wrapper) wrapper.style.display = 'none';
  });
}

function stopCameraScanner() {
  if (html5QrCode && isCameraActive) {
    html5QrCode.stop().then(() => {
      isCameraActive = false;
      const wrapper = document.getElementById('interactive-camera-wrapper');
      if (wrapper) wrapper.style.display = 'none';
      const btn = document.getElementById('camToggleBtn');
      if (btn) {
        btn.textContent = '📷 Open Live Camera Scanner';
        btn.className = 'btn btn-primary';
      }
    }).catch(err => console.error(err));
  }
}

async function handleCameraScanSuccess(scannedCode) {
  const query = scannedCode.trim().toUpperCase();
  try {
    const variants = await apiRequest('/variants') || [];
    const match = variants.find(b => b.barcode.toUpperCase() === query || b.code.toUpperCase() === query);
    if (match) {
      addToCart(match);
    } else {
      alert(`Hindi mahanap ang item para sa Barcode: ${scannedCode}`);
    }
  } catch (err) {
    console.error(err);
  }
}

/* POS CHECKOUT MODULE */
async function renderSaleGrid() {
  const grid = document.getElementById('saleCatalogGrid');
  if (!grid) return;
  const searchInput = document.getElementById('saleSearchInput');
  const search = searchInput ? searchInput.value.trim().toUpperCase() : '';

  try {
    const variants = await apiRequest('/variants') || [];
    grid.innerHTML = '';

    const filtered = variants.filter(b => 
      b.code.toUpperCase().includes(search) ||
      b.barcode.toUpperCase().includes(search) ||
      (b.part_name && b.part_name.toUpperCase().includes(search)) ||
      (b.oem && b.oem.toUpperCase().includes(search)) ||
      (b.brand && b.brand.toUpperCase().includes(search))
    );

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div class="empty-stock-banner" style="border-color:#cbd5e1; background:#ffffff;">
          <div class="empty-stock-icon" style="background-color:#f1f5f9; color:#64748b;">🔍</div>
          <div class="empty-stock-title" style="color:#0f172a;">WALANG MAKITANG ITEM SA INVENTORY</div>
          <div class="empty-stock-sub">Magdagdag muna ng Master Item at Supplier Variant para makapag-benta.</div>
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
          <div class="item-title">${batch.part_name || 'ITEM'} - ${batch.oem || ''}</div>
          <div class="item-oem">${batch.brand || ''} | SUPPLIER: ${batch.supplier}</div>
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

function handleSaleBarcodeKey(event) {
  if (event.key === 'Enter') {
    const query = event.target.value.trim().toUpperCase();
    if (!query) return;
    event.target.value = '';
    renderSaleGrid();
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
      partName: batch.part_name || 'ITEM',
      oem: batch.oem || '',
      brand: batch.brand || '',
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
  if (!tbody) return;
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
  const cashInput = document.getElementById('cashTenderedInput');
  const cash = cashInput ? parseFloat(cashInput.value) || 0 : 0;
  const grandTotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const change = cash - grandTotal;
  const changeEl = document.getElementById('cartChangeAmount');
  if (changeEl) changeEl.textContent = `₱${change >= 0 ? change.toFixed(2) : '0.00'}`;
}

async function processCheckout() {
  if (cart.length === 0) return alert('Walang laman ang Cart!');

  const grandTotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const totalCost = cart.reduce((sum, item) => sum + (item.cost * item.qty), 0);
  const cashInput = document.getElementById('cashTenderedInput');
  const cash = cashInput ? parseFloat(cashInput.value) || 0 : 0;

  if (cash < grandTotal) return alert('Kulang ang ibinayad na Cash!');

  try {
    const payload = { cart, cash, grandTotal, totalCost, change: cash - grandTotal };
    const res = await apiRequest('/sales/checkout', 'POST', payload);

    alert(`✅ Transaction Complete!\nTxn No: ${res.txnNumber}\nTotal: ₱${grandTotal.toFixed(2)}\nChange: ₱${res.change.toFixed(2)}`);

    clearCart();
    if (cashInput) cashInput.value = '';
    renderSaleGrid();
  } catch (err) {
    alert(`❌ Checkout Failed: ${err.message}`);
  }
}

/* SALES LOG MODULE */
async function renderSalesLog() {
  const dateFilter = document.getElementById('salesDateFilter');
  const selectedDate = dateFilter ? dateFilter.value : getTodayString();
  const tbody = document.getElementById('salesLogTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  try {
    const items = await apiRequest(`/reports/daily-items?date=${selectedDate}`) || [];

    let grossSum = 0;
    let costSum = 0;
    let profitSum = 0;
    let totalPcs = 0;

    if (items.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#94a3b8; padding:24px;">Walang naitalang benta sa napiling petsa (${selectedDate}).</td></tr>`;
    } else {
      items.forEach(i => {
        const costTotal = parseFloat(i.cost) * parseInt(i.qty);
        const salesTotal = parseFloat(i.subtotal);
        const profitTotal = parseFloat(i.item_profit);

        grossSum += salesTotal;
        costSum += costTotal;
        profitSum += profitTotal;
        totalPcs += parseInt(i.qty);

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>
            <strong>${new Date(i.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</strong><br>
            <small style="color:#64748b;">${i.txn_number}</small>
          </td>
          <td style="font-size:13px; font-weight:600;">• ${i.part_name} (${i.oem || i.variant_code})</td>
          <td style="text-align:center; font-weight:bold;">${i.qty}</td>
          <td style="text-align:right; color:#ea580c;">₱${costTotal.toFixed(2)}</td>
          <td style="text-align:right; font-weight:bold; color:#2563eb;">₱${salesTotal.toFixed(2)}</td>
          <td style="text-align:right; font-weight:bold; color:#16a34a;">₱${profitTotal.toFixed(2)}</td>
        `;
        tbody.appendChild(tr);
      });
    }

    document.getElementById('salesGrossTotal').textContent = `₱${grossSum.toLocaleString('en-US', {minimumFractionDigits: 2})}`;
    document.getElementById('salesCostTotal').textContent = `₱${costSum.toLocaleString('en-US', {minimumFractionDigits: 2})}`;
    document.getElementById('salesProfitTotal').textContent = `₱${profitSum.toLocaleString('en-US', {minimumFractionDigits: 2})}`;
    document.getElementById('salesTxnCount').textContent = items.length;
    document.getElementById('salesItemsCount').textContent = `${totalPcs} total pcs sold`;
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" style="color:red; text-align:center;">Failed to load sales log: ${err.message}</td></tr>`;
  }
}

/* REPORTS MODULE & DRILL-DOWN */
function renderReportsModule() {
  renderBreadcrumbs();
  document.getElementById('rptYearlySubView').style.display = activeReportLevel === 'yearly' ? 'block' : 'none';
  document.getElementById('rptMonthlySubView').style.display = activeReportLevel === 'monthly' ? 'block' : 'none';
  document.getElementById('rptDailySubView').style.display = activeReportLevel === 'daily' ? 'block' : 'none';

  if (activeReportLevel === 'yearly') renderYearlyReport();
  else if (activeReportLevel === 'monthly') renderMonthlyReport();
  else if (activeReportLevel === 'daily') renderDailyReport();
}

function renderBreadcrumbs() {
  const container = document.getElementById('reportBreadcrumbs');
  if (!container) return;
  let html = `<span class="${activeReportLevel === 'yearly' ? 'crumb-active' : 'crumb-item'}" onclick="goToYearlyView()">📊 Yearly (${currentSelectedYear})</span>`;

  if (activeReportLevel === 'monthly' || activeReportLevel === 'daily') {
    const mName = monthNames[parseInt(currentSelectedMonth) - 1];
    html += ` ➔ <span class="${activeReportLevel === 'monthly' ? 'crumb-active' : 'crumb-item'}" onclick="goToMonthlyView()">📆 ${mName} ${currentSelectedYear}</span>`;
  }
  if (activeReportLevel === 'daily') {
    html += ` ➔ <span class="crumb-active">📄 ${currentSelectedDate} Sales Details</span>`;
  }
  container.innerHTML = html;
}

function goToYearlyView() {
  activeReportLevel = 'yearly';
  renderReportsModule();
}

function goToMonthlyView(monthCode) {
  if (monthCode) currentSelectedMonth = monthCode;
  activeReportLevel = 'monthly';
  const mSelect = document.getElementById('rptMonthSelect');
  if (mSelect) mSelect.value = currentSelectedMonth;
  renderReportsModule();
}

function goToDailyView(dateStr) {
  if (dateStr) currentSelectedDate = dateStr;
  activeReportLevel = 'daily';
  renderReportsModule();
}

function handleMonthSelectChange() {
  const mSelect = document.getElementById('rptMonthSelect');
  if (mSelect) currentSelectedMonth = mSelect.value;
  renderMonthlyReport();
}

async function renderYearlyReport() {
  const yrSelect = document.getElementById('rptYearSelect');
  if (yrSelect) currentSelectedYear = yrSelect.value;
  renderBreadcrumbs();

  const tbody = document.getElementById('yearlyTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  try {
    const reports = await apiRequest(`/reports/summary?year=${currentSelectedYear}`) || [];

    let yrSales = 0, yrCost = 0, yrProfit = 0;

    for (let m = 1; m <= 12; m++) {
      const monthCode = String(m).padStart(2, '0');
      const mName = monthNames[m - 1];

      const mReports = reports.filter(r => new Date(r.txn_date).getMonth() + 1 === m);
      const mSales = mReports.reduce((sum, r) => sum + parseFloat(r.gross_sales || 0), 0);
      const mCost = mReports.reduce((sum, r) => sum + parseFloat(r.total_cost || 0), 0);
      const mProfit = mReports.reduce((sum, r) => sum + parseFloat(r.net_profit || 0), 0);
      const mTxns = mReports.reduce((sum, r) => sum + parseInt(r.total_txns || 0), 0);

      yrSales += mSales;
      yrCost += mCost;
      yrProfit += mProfit;

      const tr = document.createElement('tr');
      tr.className = 'clickable-row';
      tr.onclick = () => goToMonthlyView(monthCode);
      tr.innerHTML = `
        <td><strong>${mName} ${currentSelectedYear}</strong></td>
        <td style="text-align:center;">${mTxns}</td>
        <td style="text-align:right; color:#ea580c;">₱${mCost.toFixed(2)}</td>
        <td style="text-align:right; font-weight:bold; color:#2563eb;">₱${mSales.toFixed(2)}</td>
        <td style="text-align:right; font-weight:bold; color:#16a34a;">₱${mProfit.toFixed(2)}</td>
        <td style="text-align:center;"><button class="btn btn-secondary" style="font-size:10px; padding:3px 8px;">View Month ➔</button></td>
      `;
      tbody.appendChild(tr);
    }

    document.getElementById('yrGrossSales').textContent = `₱${yrSales.toLocaleString('en-US', {minimumFractionDigits: 2})}`;
    document.getElementById('yrTotalCost').textContent = `₱${yrCost.toLocaleString('en-US', {minimumFractionDigits: 2})}`;
    document.getElementById('yrNetProfit').textContent = `₱${yrProfit.toLocaleString('en-US', {minimumFractionDigits: 2})}`;
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" style="color:red; text-align:center;">Failed to load yearly report: ${err.message}</td></tr>`;
  }
}

async function renderMonthlyReport() {
  renderBreadcrumbs();
  const mName = monthNames[parseInt(currentSelectedMonth) - 1];
  const header = document.getElementById('monthlyTitleHeader');
  if (header) header.textContent = `📆 Monthly Breakdown — ${mName} ${currentSelectedYear}`;

  const tbody = document.getElementById('monthlyTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  try {
    const reports = await apiRequest(`/reports/summary?year=${currentSelectedYear}&month=${currentSelectedMonth}`) || [];

    let mnSales = 0, mnCost = 0, mnProfit = 0;
    const daysInMonth = new Date(parseInt(currentSelectedYear), parseInt(currentSelectedMonth), 0).getDate();

    for (let day = 1; day <= daysInMonth; day++) {
      const dayStr = String(day).padStart(2, '0');
      const fullDate = `${currentSelectedYear}-${currentSelectedMonth}-${dayStr}`;

      const dReport = reports.find(r => r.txn_date && r.txn_date.startsWith(fullDate)) || { gross_sales: 0, total_cost: 0, net_profit: 0, total_txns: 0 };

      const dSales = parseFloat(dReport.gross_sales || 0);
      const dCost = parseFloat(dReport.total_cost || 0);
      const dProfit = parseFloat(dReport.net_profit || 0);
      const dTxns = parseInt(dReport.total_txns || 0);

      mnSales += dSales;
      mnCost += dCost;
      mnProfit += dProfit;

      const tr = document.createElement('tr');
      if (dTxns > 0) {
        tr.className = 'clickable-row';
        tr.onclick = () => goToDailyView(fullDate);
      }

      tr.innerHTML = `
        <td><strong>${fullDate} (${mName.substring(0, 3)} ${day})</strong></td>
        <td style="text-align:center;">${dTxns}</td>
        <td style="text-align:right; color:#ea580c;">₱${dCost.toFixed(2)}</td>
        <td style="text-align:right; font-weight:bold; color:#2563eb;">₱${dSales.toFixed(2)}</td>
        <td style="text-align:right; font-weight:bold; color:#16a34a;">₱${dProfit.toFixed(2)}</td>
        <td style="text-align:center;">
          ${dTxns > 0 ? `<button class="btn btn-primary" style="font-size:10px; padding:3px 8px;">View Details ➔</button>` : `<span style="color:#94a3b8; font-size:11px;">No Sales</span>`}
        </td>
      `;
      tbody.appendChild(tr);
    }

    document.getElementById('mnGrossSales').textContent = `₱${mnSales.toLocaleString('en-US', {minimumFractionDigits: 2})}`;
    document.getElementById('mnTotalCost').textContent = `₱${mnCost.toLocaleString('en-US', {minimumFractionDigits: 2})}`;
    document.getElementById('mnNetProfit').textContent = `₱${mnProfit.toLocaleString('en-US', {minimumFractionDigits: 2})}`;
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" style="color:red; text-align:center;">Failed to load monthly report: ${err.message}</td></tr>`;
  }
}

async function renderDailyReport() {
  renderBreadcrumbs();
  const header = document.getElementById('dailyTitleHeader');
  if (header) header.textContent = `📄 Daily Items Sales Log — ${currentSelectedDate}`;
  const subText = document.getElementById('dailySubDateText');
  if (subText) subText.textContent = `Date Filtered: ${currentSelectedDate}`;

  const tbody = document.getElementById('dailyTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  try {
    const items = await apiRequest(`/reports/daily-items?date=${currentSelectedDate}`) || [];

    let dySales = 0, dyCost = 0, dyProfit = 0;

    if (items.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#94a3b8; padding:24px;">Walang naitalang benta para sa araw na ito (${currentSelectedDate}).</td></tr>`;
    } else {
      items.forEach(i => {
        const costTotal = parseFloat(i.cost) * parseInt(i.qty);
        const salesTotal = parseFloat(i.subtotal);
        const profitTotal = parseFloat(i.item_profit);

        dySales += salesTotal;
        dyCost += costTotal;
        dyProfit += profitTotal;

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>
            <strong>${new Date(i.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</strong><br>
            <small style="color:#64748b;">${i.txn_number}</small>
          </td>
          <td style="font-size:13px; font-weight:600;">• ${i.part_name} (${i.oem || i.variant_code})</td>
          <td style="text-align:center; font-weight:bold;">${i.qty}</td>
          <td style="text-align:right; color:#ea580c;">₱${costTotal.toFixed(2)}</td>
          <td style="text-align:right; font-weight:bold; color:#2563eb;">₱${salesTotal.toFixed(2)}</td>
          <td style="text-align:right; font-weight:bold; color:#16a34a;">₱${profitTotal.toFixed(2)}</td>
        `;
        tbody.appendChild(tr);
      });
    }

    document.getElementById('dyGrossSales').textContent = `₱${dySales.toLocaleString('en-US', {minimumFractionDigits: 2})}`;
    document.getElementById('dyTotalCost').textContent = `₱${dyCost.toLocaleString('en-US', {minimumFractionDigits: 2})}`;
    document.getElementById('dyNetProfit').textContent = `₱${dyProfit.toLocaleString('en-US', {minimumFractionDigits: 2})}`;
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" style="color:red; text-align:center;">Failed to load daily report: ${err.message}</td></tr>`;
  }
}

/* CENTRAL INVENTORY MODULE */
async function renderInventoryGrid() {
  const container = document.getElementById('inventoryRowContainer');
  if (!container) return;
  const searchInput = document.getElementById('inventorySearch');
  const search = searchInput ? searchInput.value.toUpperCase() : '';
  container.innerHTML = '';

  try {
    const masters = await apiRequest('/masters') || [];
    const variants = await apiRequest('/variants') || [];

    if (masters.length === 0) {
      container.innerHTML = `<p style="padding:20px; text-align:center; color:#64748b;">Walang Master Items sa database. Mag-register muna sa Master Items tab.</p>`;
      return;
    }

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

function openQuickAddMasterModal() {
  switchView('view-master', document.querySelectorAll('.nav-item')[4]);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* USER MANAGEMENT MODULE */
async function renderUsersTable() {
  const tbody = document.getElementById('usersTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  try {
    const users = await apiRequest('/users') || [];
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
  const form = document.getElementById('restockForm');
  if (form) form.reset();
}

function closeRestockOnOverlay(e) {
  if (e.target.id === 'restockModal') closeRestockModal();
}

const restockForm = document.getElementById('restockForm');
if (restockForm) {
  restockForm.addEventListener('submit', async function(e) {
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
}

function openQuickCodingModal(masterId) {
  document.getElementById('quickMasterIdInput').value = masterId;
  document.getElementById('quickCodingMasterSub').textContent = `MASTER ITEM ID: ${masterId}`;
  document.getElementById('quickCodingModal').style.display = 'flex';
}

function closeQuickCodingModal() {
  document.getElementById('quickCodingModal').style.display = 'none';
  const form = document.getElementById('quickCodingForm');
  if (form) form.reset();
}

function closeQuickCodingOnOverlay(e) {
  if (e.target.id === 'quickCodingModal') closeQuickCodingModal();
}

const quickCodingForm = document.getElementById('quickCodingForm');
if (quickCodingForm) {
  quickCodingForm.addEventListener('submit', async function(e) {
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
}

/* MASTER ITEM FORM SUBMISSION & GALLERY */
function handleImageUpload(e) {}
function toggleBoxPackagingFields() {
  const unitType = document.getElementById('unitInput').value;
  const boxFields = document.getElementById('boxFields');
  if (boxFields) boxFields.style.display = unitType === 'box' ? 'block' : 'none';
}

const masterForm = document.getElementById('masterForm');
if (masterForm) {
  masterForm.addEventListener('submit', async function(e) {
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
}

async function renderStep1Grid() {
  const grid = document.getElementById('step1Grid');
  if (!grid) return;
  const searchInput = document.getElementById('step1Search');
  const search = searchInput ? searchInput.value.toUpperCase() : '';
  
  try {
    const masters = await apiRequest('/masters') || [];
    grid.innerHTML = '';

    const filtered = masters.filter(item => 
      item.oem.toUpperCase().includes(search) ||
      item.part_name.toUpperCase().includes(search) ||
      item.brand.toUpperCase().includes(search)
    );

    if (filtered.length === 0) {
      grid.innerHTML = `<p style="padding:20px; color:#64748b;">Walang registered master items.</p>`;
      return;
    }

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

/* ITEM DETAIL & LIGHTBOX MODAL CLOSERS */
function closeModal() {
  const itemModal = document.getElementById('itemModal');
  if (itemModal) itemModal.style.display = 'none';
}
function closeModalOnOverlay(e) {
  if (e.target.id === 'itemModal') closeModal();
}
function closeLightbox() {
  const lightboxOverlay = document.getElementById('lightboxOverlay');
  if (lightboxOverlay) lightboxOverlay.style.display = 'none';
}
function closeLightboxOnOverlay(e) {
  if (e.target.id === 'lightboxOverlay') closeLightbox();
}
function prevLightboxImage() {}
function nextLightboxImage() {}