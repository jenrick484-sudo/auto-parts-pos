/* ======================================================================
   DAIHO AUTOPARTS POS — PRODUCTION FRONTEND APPLICATION SCRIPT
   ====================================================================== */
confirmDirectSale(event)
/* SECURITY & UTILITY HELPERS */
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

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

/* GLOBAL APPLICATION STATE */
let loggedInUser = null;
let systemUsers = [];       
let masterItems = [];       
let inventoryBatches = [];  
let salesTransactions = []; 
let registeredSuppliers = [];

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

let currentUploadedImages = [];
let modalActiveImages = [];
let activeModalImgIndex = 0;

let html5QrCode = null;
let isCameraActive = false;
let isCameraStarting = false;
let lastScannedCode = "";
let lastScanTime = 0;

/* DIRECT SALE CONFIRMATION MODAL LOGIC */
let activeSelectedBatchForSale = null;

function openConfirmSaleModal(batchCode) {
  const batch = inventoryBatches.find(b => (b.code || b.variant_code) === batchCode);
  if (!batch) return;

  if (Number(batch.stock) <= 0) {
    alert('⚠️ Out of stock na ang item/variant na ito!');
    return;
  }
  
  const mId = batch.masterId || batch.master_id;
  const master = masterItems.find(m => Number(m.id) === Number(mId)) || { partName: 'ITEM', part_name: 'ITEM', oem: '' };
  activeSelectedBatchForSale = batch;

  document.getElementById('saleBatchCodeInput').value = batch.code || batch.variant_code;
  document.getElementById('confirmSaleSubTitle').textContent = `${master.partName || master.part_name} (${master.oem})`;
  document.getElementById('confirmBatchCode').textContent = batch.code || batch.variant_code;
  document.getElementById('confirmStock').textContent = `${batch.stock} pcs`;
  document.getElementById('confirmSupplier').textContent = batch.supplier;

  // 🖼️ LOAD ITEM IMAGES & ATTACH LIGHTBOX CLICK EVENTS
  const images = master.images || master.image_urls || [];
  modalActiveImages = images; // Isine-set sa global array para sa openLightbox()

  const paymentSelectEl = document.getElementById('salePaymentMethodInput');
  if (paymentSelectEl) paymentSelectEl.value = 'CASH';

  const galleryEl = document.getElementById('confirmImageGallery');
  if (galleryEl) {
    if (images.length > 0) {
      galleryEl.style.display = 'flex';
      galleryEl.innerHTML = images.map((img, idx) => `
        <img src="${escapeHtml(img)}" 
             style="width: 64px; height: 64px; object-fit: cover; border-radius: 6px; cursor: pointer; border: 2px solid #2563eb; transition: transform 0.2s;" 
             onclick="openLightbox(${idx})" 
             onmouseover="this.style.transform='scale(1.05)'" 
             onmouseout="this.style.transform='scale(1)'" 
             alt="Item Photo ${idx + 1}" 
             title="I-click para palakihin" />
      `).join('');
    } else {
      galleryEl.style.display = 'none';
      galleryEl.innerHTML = '';
    }
  }

  // INITIAL EDITABLE VALUES (MIN PRICE = ITEM COST)
  const defaultPrice = Number(batch.price || 0);
  const itemCost = Number(batch.cost || 0);
  const priceInputEl = document.getElementById('salePriceInput');

  priceInputEl.value = defaultPrice.toFixed(2);
  priceInputEl.min = itemCost.toFixed(2);

  document.getElementById('saleQtyInput').value = 1;
  document.getElementById('saleQtyInput').max = batch.stock;

  updateConfirmTotalCost();

  document.getElementById('confirmSaleModal').style.display = 'flex';
  setTimeout(() => document.getElementById('salePriceInput').focus(), 100);
}

function closeConfirmSaleModal() {
  document.getElementById('confirmSaleModal').style.display = 'none';
  activeSelectedBatchForSale = null;
}

// AUTO-RECALCULATE TOTAL AMOUNT MULA SA SELLING PRICE AT QUANTITY
function updateConfirmTotalCost() {
  const price = parseFloat(document.getElementById('salePriceInput').value) || 0;
  const qty = parseInt(document.getElementById('saleQtyInput').value) || 1;
  const total = price * qty;
  document.getElementById('saleTotalAmountDisplay').value = `₱${total.toFixed(2)}`;
}

async function confirmDirectSale(event) {
  event.preventDefault();
  if (!activeSelectedBatchForSale) return;

  const batch = activeSelectedBatchForSale;
  const mId = batch.masterId || batch.master_id;
  const master = masterItems.find(m => Number(m.id) === Number(mId)) || { partName: 'ITEM', part_name: 'ITEM', oem: '', brand: '' };

  const sellingPrice = parseFloat(document.getElementById('salePriceInput').value);
  const unitCost = Number(batch.cost || 0);
  const qty = parseInt(document.getElementById('saleQtyInput').value, 10);
  const paymentMethod = document.getElementById('salePaymentMethodInput')?.value || 'CASH';
  
  // 1. VALIDATION PARA SA EDITABLE PRICE, COST, AT QUANTITY
  if (isNaN(sellingPrice) || sellingPrice <= 0) {
    alert('⚠️ Kailangang mas mataas sa ₱0.00 ang Selling Price!');
    document.getElementById('salePriceInput').focus();
    return;
  }

  if (sellingPrice < unitCost) {
    alert(`⚠️ Hindi pwedeng mas mababa sa puhunan/cost (₱${unitCost.toFixed(2)}) ang Selling Price!`);
    document.getElementById('salePriceInput').focus();
    return;
  }

  if (isNaN(qty) || qty <= 0) {
    alert('⚠️ Kailangang hindi bababa sa 1 ang Quantity to Sell!');
    document.getElementById('saleQtyInput').focus();
    return;
  }

  if (paymentMethod !== 'CASH' && paymentMethod !== 'GCASH') {
    alert('⚠️ Pumili lamang ng CASH o G-CASH bilang Payment Method!');
    return;
  }

  const totalAmount = sellingPrice * qty;

  const salePayload = {
    user_id: loggedInUser && loggedInUser.id ? Number(loggedInUser.id) : null,
    batch_code: batch.code || batch.variant_code,
    qty: qty,
    price: sellingPrice,
    cost: Number(batch.cost),
    payment_method: paymentMethod,
    cash_tendered: totalAmount,
    change_amount: 0
  };

  try {
    await apiRequest('/sales', 'POST', salePayload);
    batch.stock = Number(batch.stock) - qty;

    const paymentLabel = paymentMethod === 'GCASH' ? 'G-CASH' : 'CASH';
    alert(`✅ Direct Sale Confirmed & Saved!\n--------------------\nItem: ${master.partName || master.part_name}\nUnit Price: ₱${sellingPrice.toFixed(2)}\nQty: ${qty}\nPayment: ${paymentLabel}\nTotal Amount: ₱${totalAmount.toFixed(2)}`);

    closeConfirmSaleModal();
    await loadProductionDataFromBackend();
    renderSaleGrid();
    if (typeof renderSalesLog === 'function') renderSalesLog();
    if (typeof renderDashboard === 'function') renderDashboard();
    if (typeof renderReportsModule === 'function') renderReportsModule();
  } catch (err) {
    console.error('Sale Save Error:', err);
    alert(`❌ Nabigong i-save ang benta sa database: ${err.message}`);
  }
}

/* BACKEND DATA SYNCHRONIZATION */
async function loadProductionDataFromBackend() {
  try {
    const [mastersRes, variantsRes, salesRes, usersRes, suppliersRes] = await Promise.all([
      apiRequest('/masters', 'GET').catch(() => []),
      apiRequest('/variants', 'GET').catch(() => []),
      apiRequest('/sales', 'GET').catch(() => []),
      apiRequest('/users', 'GET').catch(() => []),
      apiRequest('/suppliers', 'GET').catch(() => [])
    ]);

    masterItems = Array.isArray(mastersRes) ? mastersRes : (mastersRes.masters || []);
    inventoryBatches = Array.isArray(variantsRes) ? variantsRes : (variantsRes.variants || []);
    salesTransactions = Array.isArray(salesRes) ? salesRes : (salesRes.sales || []);
    systemUsers = Array.isArray(usersRes) ? usersRes : (usersRes.users || systemUsers);
    registeredSuppliers = Array.isArray(suppliersRes) ? suppliersRes : (suppliersRes.suppliers || []);

    // I-populate agad ang supplier dropdown sa Inventory Modal
    updateSupplierDropdowns();

    console.log("✅ Production data & suppliers successfully loaded from database.");
  } catch (error) {
    console.error("❌ Error loading production data:", error);
    alert("Nabigong makuha ang data mula sa server. Suriin ang koneksyon.");
  }
}

/* AUTHENTICATION & LOGIN LOGIC */
function togglePasswordVisibility() {
  const pwdInput = document.getElementById('loginPasswordInput');
  if (pwdInput) {
    pwdInput.type = pwdInput.type === 'password' ? 'text' : 'password';
  }
}

async function handleLoginSubmit(event) {
  event.preventDefault();
  const userIn = document.getElementById('loginUsernameInput').value.trim();
  const passIn = document.getElementById('loginPasswordInput').value;
  const errorMsg = document.getElementById('loginErrorMsg');
  const submitBtn = document.getElementById('loginSubmitBtn');

  if (!userIn || !passIn) {
    if (errorMsg) {
      errorMsg.style.display = 'block';
      errorMsg.textContent = '⚠️ Ilagay ang iyong Username at Password.';
    }
    return;
  }

  if (errorMsg) errorMsg.style.display = 'none';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="btn-text">NAGMAMA-LOGIN...</span>';
  }

  try {
    // Direktang i-verify ang credentials sa Backend API (/api/auth/login)
    const authRes = await apiRequest('/auth/login', 'POST', {
      username: userIn,
      password: passIn
    });

    const authenticatedUser = authRes?.user || authRes?.data;

    if (!authenticatedUser) {
      throw new Error('Hindi wasto ang tugon mula sa authentication server.');
    }

    loggedInUser = authenticatedUser;
    if (authRes.token) {
      localStorage.setItem('pos_token', authRes.token);
    }

    const loginScreen = document.getElementById('loginScreen');
    if (loginScreen) loginScreen.style.display = 'none';

    const loginForm = document.getElementById('loginForm');
    if (loginForm) loginForm.reset();

    const nameEl = document.getElementById('activeUserFullName');
    if (nameEl) nameEl.textContent = loggedInUser.fullName || loggedInUser.full_name || loggedInUser.username;

    const roleEl = document.getElementById('activeUserRoleBadge');
    if (roleEl) roleEl.textContent = loggedInUser.role;

    // I-load ang production data mula sa PostgreSQL
    await loadProductionDataFromBackend();
    applyUserRoleRestrictions();

    if (loggedInUser.role !== 'CASHIER') {
      switchView('view-dashboard', document.querySelectorAll('.nav-item')[0]);
    }

  } catch (err) {
    console.error('Login Failed:', err);
    if (errorMsg) {
      errorMsg.style.display = 'block';
      errorMsg.textContent = `❌ ${err.message || 'Mali ang Username o Password!'}`;
    }
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<span class="btn-text">MAG-LOGIN</span>';
    }
  }
}

function handleLogout() {
  if (confirm('Sigurado ka bang gusto mong mag-logout?')) {
    loggedInUser = null;
    localStorage.removeItem('pos_token');
    stopCameraScanner();
    const loginScreen = document.getElementById('loginScreen');
    if (loginScreen) loginScreen.style.display = 'flex';
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
      if (idx === 7) item.style.display = 'none';
      else item.style.display = 'flex';
    });
  } else {
    navItems.forEach(item => item.style.display = 'flex');
  }
}

/* NAVIGATION & VIEW SWITCHER */
function switchView(viewId, element) {
  if (!loggedInUser) return;

  if (loggedInUser.role === 'CASHIER' && viewId !== 'view-sale') {
    alert('Restricted access: Cashier can only access POS Checkout.');
    return;
  }
  if (loggedInUser.role === 'MANAGER' && viewId === 'view-users') {
    alert('Restricted access: Managers cannot access System Users.');
    return;
  }
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
    'view-suppliers': 'Supplier Management',
    'view-users': 'User Management & Accounts'
  };
  const titleEl = document.getElementById('pageTitle');
  if (titleEl && titles[viewId]) titleEl.textContent = titles[viewId];

  if (viewId === 'view-dashboard') renderDashboard();
  if (viewId === 'view-sale') {
    renderSaleGrid();
    const sInput = document.getElementById('saleSearchInput');
    if (sInput) sInput.focus();
  } else {
    stopCameraScanner();
  }

  if (viewId === 'view-sales-log') renderSalesLog();
  if (viewId === 'view-reports') renderReportsModule();
  if (viewId === 'view-master') renderStep1Grid();
  if (viewId === 'view-inventory') renderInventoryGrid();
  if (viewId === 'view-suppliers') renderSuppliersTable();
  if (viewId === 'view-users') renderUsersTable();
}

/* DASHBOARD RENDER & CHARTS */
function renderDashboard() {
  const todayStr = getTodayString();
  const todayTxns = salesTransactions.filter(t => t.date === todayStr);

  const todayGross = todayTxns.reduce((sum, t) => sum + (Number(t.grandTotal || t.grand_total) || 0), 0);
  const todayProfit = todayTxns.reduce((sum, t) => sum + (Number(t.totalProfit || t.total_profit) || 0), 0);

  document.getElementById('dashTodaySales').textContent = `₱${todayGross.toLocaleString('en-US', {minimumFractionDigits: 2})}`;
  document.getElementById('dashTodayProfit').textContent = `₱${todayProfit.toLocaleString('en-US', {minimumFractionDigits: 2})}`;

  const outOfStockList = inventoryBatches.filter(b => Number(b.stock) === 0);
  const lowStockList = inventoryBatches.filter(b => Number(b.stock) > 0 && Number(b.stock) <= Number(b.lowStockLimit || 0));
  const totalAlerts = outOfStockList.length + lowStockList.length;

  document.getElementById('dashLowStockCount').textContent = `${totalAlerts} Items`;
  document.getElementById('dashOutStockSub').textContent = `${outOfStockList.length} Out of Stock | ${lowStockList.length} Low Stock`;

  const assetValuation = inventoryBatches.reduce((sum, b) => sum + (Number(b.cost || 0) * Number(b.stock || 0)), 0);
  document.getElementById('dashAssetValuation').textContent = `₱${assetValuation.toLocaleString('en-US', {minimumFractionDigits: 2})}`;
  document.getElementById('dashTotalItemsCount').textContent = `${masterItems.length} Masters | ${inventoryBatches.length} Variants`;

  const reorderBody = document.getElementById('dashReorderTableBody');
  if (reorderBody) {
    reorderBody.innerHTML = '';
    const criticalVariants = [...outOfStockList, ...lowStockList].slice(0, 5);

    if (criticalVariants.length === 0) {
      reorderBody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#16a34a; padding:16px;">✅ All items have healthy stock levels!</td></tr>`;
    } else {
      criticalVariants.forEach(b => {
        const master = masterItems.find(m => m.id === b.masterId || m.master_id === b.masterId) || { partName: 'ITEM', oem: '' };
        const badgeClass = Number(b.stock) === 0 ? 'stock-red' : 'stock-orange';
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong>${escapeHtml(b.code || b.variant_code)}</strong></td>
          <td>${escapeHtml(master.partName || master.part_name)} (${escapeHtml(master.oem)})</td>
          <td style="text-align:center;"><span class="stock-badge ${badgeClass}">${b.stock}</span></td>
          <td style="text-align:center;">
            <button class="btn btn-primary" style="font-size:10px; padding:2px 6px;" onclick="goToInventoryAndRestock('${escapeHtml(b.code || b.variant_code)}')">➕ Restock</button>
          </td>
        `;
        reorderBody.appendChild(tr);
      });
    }
  }

  const recentBody = document.getElementById('dashRecentSalesBody');
  if (recentBody) {
    recentBody.innerHTML = '';
    const recentTxns = salesTransactions.slice(0, 5);

    if (recentTxns.length === 0) {
      recentBody.innerHTML = `<tr><td colspan="2" style="text-align:center; color:#94a3b8; padding:16px;">No transactions logged yet.</td></tr>`;
    } else {
      recentTxns.forEach(t => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong>${escapeHtml(t.time || '')}</strong><br><small style="color:#64748b;">${escapeHtml(t.id || t.transaction_id)}</small></td>
          <td style="text-align:right; font-weight:800; color:#2563eb;">₱${Number(t.grandTotal || t.grand_total || 0).toFixed(2)}</td>
        `;
        recentBody.appendChild(tr);
      });
    }
  }

  renderDashboardCharts();
}

function renderDashboardCharts() {
  // Ligtas na check kung naka-load ang Chart.js library
  if (typeof Chart === 'undefined') {
    console.warn("Chart.js library is not loaded.");
    return;
  }
  const ctxSales = document.getElementById('salesTrendChart');
  if (!ctxSales) return;
  if (salesChartInstance) salesChartInstance.destroy();

  const trendLabels = [];
  const trendValues = [];
  const today = new Date();
  for (let offset = 6; offset >= 0; offset--) {
    const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset);
    const dateKey = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
    trendLabels.push(day.toLocaleDateString('en-US', { weekday: 'short' }));
    trendValues.push(salesTransactions.filter(txn => txn.date === dateKey).reduce((sum, txn) => sum + (Number(txn.grandTotal || txn.grand_total) || 0), 0));
  }

  salesChartInstance = new Chart(ctxSales.getContext('2d'), {
    type: 'line',
    data: {
      labels: trendLabels,
      datasets: [{
        label: 'Daily Sales (₱)',
        data: trendValues,
        borderColor: '#2563eb',
        backgroundColor: 'rgba(37, 99, 235, 0.08)',
        fill: true,
        tension: 0.3,
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } }
    }
  });

  const itemSalesMap = {};
  salesTransactions.forEach(t => {
    const items = t.items || t.transaction_items || [];
    items.forEach(i => {
      const pName = i.partName || i.part_name || 'ITEM';
      const bCode = i.batchCode || i.batch_code || i.oem || '';
      const key = `${pName} (${bCode})`;
      itemSalesMap[key] = (itemSalesMap[key] || 0) + Number(i.qty || i.quantity || 0);
    });
  });

  let labels = Object.keys(itemSalesMap);
  let data = Object.values(itemSalesMap);
  if (labels.length === 0) {
    labels = ['No sales recorded'];
    data = [0];
  }

  const ctxBrand = document.getElementById('brandShareChart');
  if (!ctxBrand) return;
  if (brandChartInstance) brandChartInstance.destroy();

  brandChartInstance = new Chart(ctxBrand.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: labels.slice(0, 5),
      datasets: [{
        data: data.slice(0, 5),
        backgroundColor: ['#2563eb', '#16a34a', '#ea580c', '#8b5cf6', '#ec4899']
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom' } }
    }
  });
}

/* MASTER ITEM REGISTRATION */
function handleImageUpload(event) {
  const files = Array.from(event.target.files);
  if (currentUploadedImages.length + files.length > 10) {
    alert('Maximum 10 pictures allowed per item!');
  }
  const availableSlots = 10 - currentUploadedImages.length;
  const filesToProcess = files.slice(0, availableSlots);

  let processedCount = 0;
  filesToProcess.forEach(file => {
    const reader = new FileReader();
    reader.onload = function(e) {
      currentUploadedImages.push(e.target.result);
      processedCount++;
      if (processedCount === filesToProcess.length) {
        renderFormImagePreviews();
      }
    };
    reader.readAsDataURL(file);
  });
  event.target.value = '';
}

function renderFormImagePreviews() {
  const preview = document.getElementById('imagePreview');
  if (!preview) return;
  if (currentUploadedImages.length === 0) {
    preview.innerHTML = 'No images uploaded yet (0/10)';
    return;
  }

  let html = `<div class="thumb-grid">`;
  currentUploadedImages.forEach((img, idx) => {
    html += `
      <div class="thumb-item">
        <img src="${img}" alt="Preview">
        <button type="button" class="remove-thumb-btn" onclick="removeUploadedImage(${idx})">&times;</button>
      </div>
    `;
  });
  html += `</div>`;
  preview.innerHTML = html;
}

function removeUploadedImage(idx) {
  currentUploadedImages.splice(idx, 1);
  renderFormImagePreviews();
}

function toggleBoxPackagingFields() {
  const unitType = document.getElementById('unitInput').value;
  const boxFields = document.getElementById('boxFields');
  if (boxFields) boxFields.style.display = (unitType === 'box') ? 'block' : 'none';
}

function renderCardMedia(item) {
  const images = item.images || item.image_urls || [];
  if (images.length > 0) {
    const badge = images.length > 1 ? `<span class="photo-count-badge">📷 ${images.length}</span>` : '';
    const imageSrc = String(images[0] || '');
    const safeImageSrc = /^(https:\/\/|data:image\/(png|jpeg|jpg|gif|webp);base64,)/i.test(imageSrc) ? escapeHtml(imageSrc) : '';
    return `<img src="${safeImageSrc}" alt="${escapeHtml(item.partName || item.part_name)}">${badge}`;
  }
  return item.icon || '⚙️';
}

function formatValueOrNA(val) {
  if (!val || val.toString().trim() === "") return `<span class="na-text">N/A</span>`;
  return val.toString().toUpperCase();
}

function formatPackagingText(item) {
  const uType = item.unitType || item.unit_type;
  if (uType === 'box') {
    const pcs = (item.pcsPerBox || item.pcs_per_box) ? `${item.pcsPerBox || item.pcs_per_box} PCS` : 'N/A PCS';
    const sz = (item.sizePerPc || item.size_per_pc) ? (item.sizePerPc || item.size_per_pc).toUpperCase() : 'N/A SIZE';
    return `BOX (${pcs} X ${sz})`;
  } else if (uType === 'set') {
    return 'SET';
  }
  return '1 PC (PIECE)';
}

function buildStockBadgeHtml(batch, unitTypeLabel) {
  const currentStock = Number(batch.stock || 0);
  const limit = Number(batch.lowStockLimit || batch.low_stock_limit || 0);
  if (currentStock === 0) {
    return `<span class="stock-badge stock-red">0 OUT OF STOCK</span>`;
  } else if (currentStock <= limit) {
    return `<span class="stock-badge stock-orange">⚠️ ${currentStock} LOW STOCK</span>`;
  }
  return `<span class="stock-badge stock-green">${currentStock} ${(unitTypeLabel || 'PC').toUpperCase()}</span>`;
}

function renderStep1Grid() {
  const grid = document.getElementById('step1Grid');
  const searchInput = document.getElementById('step1Search');
  if (!grid) return;
  const search = searchInput ? searchInput.value.toUpperCase() : '';
  grid.innerHTML = '';

  const filtered = masterItems.filter(item => {
    const oem = (item.oem || '').toUpperCase();
    const pName = (item.partName || item.part_name || '').toUpperCase();
    const brand = (item.brand || '').toUpperCase();
    const model = (item.model || '').toUpperCase();
    return oem.includes(search) || pName.includes(search) || brand.includes(search) || model.includes(search);
  });

  filtered.forEach(item => {
    const originalIndex = masterItems.findIndex(m => m.id === item.id);
    const card = document.createElement('div');
    card.className = 'item-card';
    card.onclick = () => openItemModal(originalIndex);

    const pName = item.partName || item.part_name || 'ITEM';
    card.innerHTML = `
      <div>
        <div class="card-img-placeholder">${renderCardMedia(item)}</div>
        <div class="item-title">${escapeHtml(pName)} - ${escapeHtml(item.oem)}</div>
        <div class="item-oem">${escapeHtml(item.brand)} | VEHICLE : ${escapeHtml(item.make || '')} ${escapeHtml(item.model || '')}</div>
        <div class="item-subtitle">${escapeHtml(item.engine ? '(' + item.engine + ')' : '')}</div>
      </div>
    `;
    grid.appendChild(card);
  });
}

document.getElementById('masterForm')?.addEventListener('submit', async function(e) {
  e.preventDefault();
  const unitType = document.getElementById('unitInput').value;

  const newMasterPayload = {
    oem: toUpper(document.getElementById('oemInput').value),
    brand: toUpper(document.getElementById('brandInput').value),
    part_name: toUpper(document.getElementById('partNameInput').value),
    make: toUpper(document.getElementById('vehicleMakeInput').value),
    model: toUpper(document.getElementById('vehicleModelInput').value),
    year: toUpper(document.getElementById('yearInput').value),
    engine: toUpper(document.getElementById('engineInput').value),
    unit_type: unitType,
    pcs_per_box: unitType === 'box' ? document.getElementById('pcsPerBoxInput').value : '',
    size_per_pc: unitType === 'box' ? toUpper(document.getElementById('sizePerPcInput').value) : '',
    position: toUpper(document.getElementById('positionInput').value),
    origin: toUpper(document.getElementById('originInput').value),
    description: toUpper(document.getElementById('descInput').value),
    images: [...currentUploadedImages]
  };

  try {
    const response = await apiRequest('/masters', 'POST', newMasterPayload);
    if (response) {
      await loadProductionDataFromBackend();
      renderStep1Grid();
      this.reset();
      currentUploadedImages = [];
      renderFormImagePreviews();
      alert('Master Item saved successfully to database!');
    }
  } catch (err) {
    console.error("Error saving master item:", err);
  }
});

/* INVENTORY & RESTOCK */
function openQuickAddMasterModal() {
  switchView('view-master', document.querySelectorAll('.nav-item')[4]);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function goToInventoryAndRestock(batchCode) {
  switchView('view-inventory', document.querySelectorAll('.nav-item')[5]);
  const searchInput = document.getElementById('inventorySearch');
  if (searchInput) {
    searchInput.value = batchCode;
    renderInventoryGrid();
  }
  openRestockModal(batchCode);
}

function openRestockModal(batchCode) {
  const batch = inventoryBatches.find(b => (b.code || b.variant_code) === batchCode);
  if (!batch) return;
  const mId = batch.masterId || batch.master_id;
  const master = masterItems.find(m => Number(m.id) === Number(mId)) || { partName: 'ITEM', part_name: 'ITEM' };

  document.getElementById('restockBatchCodeInput').value = batch.code || batch.variant_code;
  document.getElementById('restockBatchSub').textContent = `${batch.code || batch.variant_code} | ${master.partName || master.part_name} (${batch.supplier})`;
  document.getElementById('restockCurrentStock').value = `${batch.stock}`;
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

  const batchCode = document.getElementById('restockBatchCodeInput').value;
  const addQty = parseInt(document.getElementById('restockAddQty').value) || 0;

  if (addQty <= 0) {
    alert('⚠️ Maglagay ng wastong dami ng stock na idadagdag.');
    return;
  }

  try {
    await apiRequest(`/variants/${batchCode}/restock`, 'PATCH', { addQty });
    closeRestockModal();
    // NA-FIX NA ANG FUNCTION NAME DITO:
    await loadProductionDataFromBackend();
    renderInventoryGrid();
    alert(`✅ Matagumpay na naidagdag ang +${addQty} stock sa database para sa ${batchCode}!`);
  } catch (err) {
    alert(`❌ Nabigong mag-restock: ${err.message}`);
  }
});

function openQuickCodingModal(masterId) {
  const master = masterItems.find(m => Number(m.id) === Number(masterId));
  if (!master) return;

  updateSupplierDropdowns();

  document.getElementById('quickMasterIdInput').value = master.id;
  document.getElementById('quickCodingMasterSub').textContent = `${master.partName || master.part_name} - ${master.oem} | ${master.brand}`;
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

  if (!supplier) {
    alert('⚠️ Pumili muna ng rehistradong supplier.');
    return;
  }

  try {
    await apiRequest('/variants', 'POST', {
      masterId,
      supplier,
      cost,
      price,
      stock,
      lowStockLimit
    });

    closeQuickCodingModal();
    // NA-FIX NA ANG FUNCTION NAME DITO:
    await loadProductionDataFromBackend();
    renderInventoryGrid();
    alert('✅ Matagumpay na naidagdag ang bagong variant sa database!');
  } catch (err) {
    alert(`❌ Nabigong magdagdag ng variant: ${err.message}`);
  }
});

function getMasterItemTotalStock(masterId) {
  return inventoryBatches
    .filter(b => Number(b.masterId || b.master_id) === Number(masterId))
    .reduce((sum, b) => sum + Number(b.stock || 0), 0);
}

function renderInventoryGrid() {
  const container = document.getElementById('inventoryRowContainer');
  const searchInput = document.getElementById('inventorySearch');
  if (!container) return;
  const search = searchInput ? searchInput.value.toUpperCase() : '';
  container.innerHTML = '';

  const sortedMasterItems = [...masterItems].sort((a, b) => {
    const stockA = getMasterItemTotalStock(a.id);
    const stockB = getMasterItemTotalStock(b.id);
    const isOutA = stockA === 0 ? 0 : 1;
    const isOutB = stockB === 0 ? 0 : 1;
    if (isOutA !== isOutB) return isOutA - isOutB;
    const pA = a.partName || a.part_name || '';
    const pB = b.partName || b.part_name || '';
    return pA.localeCompare(pB);
  });

  sortedMasterItems.forEach((master, mIdx) => {
    const mId = master.id;
    const batches = inventoryBatches
      .filter(b => Number(b.masterId || b.master_id) === Number(mId))
      .sort((a, b) => (a.code || a.variant_code || '').localeCompare(b.code || b.variant_code || ''));
    const totalStock = batches.reduce((sum, b) => sum + Number(b.stock || 0), 0);

    const oem = (master.oem || '').toUpperCase();
    const pName = (master.partName || master.part_name || '').toUpperCase();
    const brand = (master.brand || '').toUpperCase();
    const model = (master.model || '').toUpperCase();

    const matchesMaster = oem.includes(search) || pName.includes(search) || brand.includes(search) || model.includes(search);
    const matchesBatch = batches.some(b => {
      const bCode = (b.code || b.variant_code || '').toUpperCase();
      const bSupp = (b.supplier || '').toUpperCase();
      return bCode.includes(search) || bSupp.includes(search);
    });

    if (matchesMaster || matchesBatch) {
      const rowCard = document.createElement('div');
      rowCard.className = 'master-row-card';
      rowCard.innerHTML = `
        <div class="master-row-header">
          <div class="master-row-left" onclick="toggleInventoryBatchPanel('batchPanel_${mIdx}')">
            <div class="master-row-thumb">${renderCardMedia(master)}</div>
            <div>
              <div class="master-row-title">${escapeHtml(master.partName || master.part_name)} - ${escapeHtml(master.oem)}</div>
              <div class="master-row-sub">${escapeHtml(master.brand)} | VEHICLE : ${escapeHtml(master.make || '')} ${escapeHtml(master.model || '')}</div>
            </div>
          </div>
          <div class="master-row-actions">
            <button class="btn btn-secondary" style="font-size:11px; padding:6px 12px;" onclick="openQuickCodingModal(${mId})">➕ New Variant</button>
            <div style="text-align:right; cursor:pointer;" onclick="toggleInventoryBatchPanel('batchPanel_${mIdx}')">
              <span class="stock-badge ${totalStock > 0 ? 'stock-green' : 'stock-red'}">STOCK: ${totalStock}</span>
              <div style="font-size:11px; font-weight:700; color:#2563eb; margin-top:4px;">${batches.length} VARIANT(S) ▼</div>
            </div>
          </div>
        </div>
        <div id="batchPanel_${mIdx}" class="batch-expand-panel" style="display:none;">
          <div class="batch-panel-title">🏷️ ASSOCIATED VARIANT CODINGS & BARCODES</div>
          <div id="batchGrid_${mIdx}" class="catalog-grid" style="margin-top:12px;"></div>
        </div>
      `;
      container.appendChild(rowCard);

      const batchGrid = rowCard.querySelector(`#batchGrid_${mIdx}`);
      if (batches.length > 0) {
        batches.forEach((batch, bIdx) => {
          const bCard = document.createElement('div');
          bCard.className = 'item-card';
          const svgId = `inventorySvg_${mIdx}_${bIdx}`;
          const bCode = batch.code || batch.variant_code;
          const badgeHtml = buildStockBadgeHtml(batch, master.unitType || master.unit_type);

          bCard.innerHTML = `
            <div>
              <div class="item-title" style="color:#2563eb;">${escapeHtml(bCode)}</div>
              <div class="item-subtitle" style="margin-bottom:6px;">SUPPLIER: ${escapeHtml(batch.supplier)}</div>
              <div class="barcode-card-box"><svg id="${svgId}" class="barcode-svg"></svg></div>
            </div>
            <div class="card-footer">
              <div>
                <div class="item-price">₱${Number(batch.price || 0).toFixed(2)}</div>
                <div style="font-size:10px; color:#64748b;">COST: ₱${Number(batch.cost || 0).toFixed(2)}</div>
              </div>
              <div style="text-align:right;">
                <div>${badgeHtml}</div>
                <div style="margin-top:6px; display:flex; gap:4px; justify-content:flex-end;">
                  <button class="btn btn-primary" style="font-size:10px; padding:3px 8px;" onclick="openRestockModal('${escapeHtml(bCode)}')">➕ Add Stock</button>
                </div>
              </div>
            </div>
          `;
          batchGrid.appendChild(bCard);
          setTimeout(() => {
            const svgEl = document.getElementById(svgId);
            if (svgEl) {
              JsBarcode(`#${svgId}`, batch.barcode || bCode, { format: "CODE128", width: 1.4, height: 26, fontSize: 10 });
            }
          }, 40);
        });
      } else {
        batchGrid.innerHTML = `<span class="na-text" style="padding:10px;">NO VARIANT CREATED YET.</span>`;
      }
    }
  });
}

function toggleInventoryBatchPanel(panelId) {
  const panel = document.getElementById(panelId);
  if (panel) {
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  }
}

/* ITEM MODAL & LIGHTBOX */
function openItemModal(index) {
  const item = masterItems[index];
  if (!item) return;

  const pName = item.partName || item.part_name || 'ITEM';
  document.getElementById('modalPartName').textContent = `${toUpper(pName)} - ${toUpper(item.oem)}`;
  document.getElementById('modalOemSubtitle').textContent = `${toUpper(item.brand)} | ${toUpper(item.make)} ${toUpper(item.model)}`;

  modalActiveImages = item.images || item.image_urls || [];
  activeModalImgIndex = 0;
  renderModalGallery();

  document.getElementById('mBrand').innerHTML = formatValueOrNA(item.brand);
  document.getElementById('mOem').innerHTML = formatValueOrNA(item.oem);
  document.getElementById('mMake').innerHTML = formatValueOrNA(item.make);
  document.getElementById('mModel').innerHTML = formatValueOrNA(item.model);
  document.getElementById('mYear').innerHTML = formatValueOrNA(item.year);
  document.getElementById('mEngine').innerHTML = formatValueOrNA(item.engine);
  document.getElementById('mUnit').innerHTML = formatPackagingText(item);
  document.getElementById('mPosition').innerHTML = formatValueOrNA(item.position);
  document.getElementById('mOrigin').innerHTML = formatValueOrNA(item.origin);
  document.getElementById('mDesc').innerHTML = formatValueOrNA(item.description);

  const batchesList = document.getElementById('modalBatchesList');
  const relatedBatches = inventoryBatches.filter(b => Number(b.masterId || b.master_id) === Number(item.id));
  if (relatedBatches.length > 0) {
    batchesList.innerHTML = '';
    relatedBatches.forEach((batch, bIdx) => {
      const div = document.createElement('div');
      div.className = 'batch-barcode-card';
      const svgId = `modalBarcode_${item.id}_${bIdx}`;
      const bCode = batch.code || batch.variant_code;
      div.innerHTML = `
        <div class="batch-barcode-info">
          <strong>${escapeHtml(bCode)}</strong> | ${escapeHtml(batch.supplier)}<br>
          <span style="color:#16a34a; font-weight:700;">₱${Number(batch.price || 0).toFixed(2)}</span>
        </div>
        <div style="text-align:right;"><svg id="${svgId}" class="barcode-svg"></svg></div>
      `;
      batchesList.appendChild(div);
      setTimeout(() => {
        JsBarcode(`#${svgId}`, batch.barcode || bCode, { format: "CODE128", width: 1.5, height: 25, fontSize: 10 });
      }, 50);
    });
  } else {
    batchesList.innerHTML = `<span class="na-text">No Variant generated yet.</span>`;
  }

  document.getElementById('itemModal').style.display = 'flex';
}

function renderModalGallery() {
  const mainContainer = document.getElementById('modalGalleryMain');
  const thumbRow = document.getElementById('modalThumbRow');
  if (!mainContainer) return;

  if (modalActiveImages.length > 0) {
    mainContainer.innerHTML = `<img src="${modalActiveImages[activeModalImgIndex]}" onclick="openLightbox(${activeModalImgIndex})" alt="Zoom">`;
    if (modalActiveImages.length > 1 && thumbRow) {
      thumbRow.style.display = 'flex';
      thumbRow.innerHTML = modalActiveImages.map((img, idx) => `
        <img src="${img}" class="modal-thumb ${idx === activeModalImgIndex ? 'active' : ''}" onclick="setModalMainImg(${idx})" alt="Thumb">
      `).join('');
    } else if (thumbRow) {
      thumbRow.style.display = 'none';
    }
  } else {
    mainContainer.innerHTML = '⚙️';
    if (thumbRow) thumbRow.style.display = 'none';
  }
}

function setModalMainImg(idx) {
  activeModalImgIndex = idx;
  renderModalGallery();
}

function closeModal() {
  const modal = document.getElementById('itemModal');
  if (modal) modal.style.display = 'none';
}

function closeModalOnOverlay(e) {
  if (e.target.id === 'itemModal') closeModal();
}

function openLightbox(index) {
  if (!modalActiveImages || modalActiveImages.length === 0) return;
  activeModalImgIndex = index;
  updateLightboxDisplay();
  document.getElementById('lightboxOverlay').style.display = 'flex';
}

function updateLightboxDisplay() {
  document.getElementById('lightboxImg').src = modalActiveImages[activeModalImgIndex];
  document.getElementById('lightboxCounter').textContent = `${activeModalImgIndex + 1} / ${modalActiveImages.length}`;
}

function prevLightboxImage() {
  if (modalActiveImages.length === 0) return;
  activeModalImgIndex = (activeModalImgIndex - 1 + modalActiveImages.length) % modalActiveImages.length;
  updateLightboxDisplay();
}

function nextLightboxImage() {
  if (modalActiveImages.length === 0) return;
  activeModalImgIndex = (activeModalImgIndex + 1) % modalActiveImages.length;
  updateLightboxDisplay();
}

function closeLightbox() {
  document.getElementById('lightboxOverlay').style.display = 'none';
}

function closeLightboxOnOverlay(e) {
  if (e.target.id === 'lightboxOverlay') closeLightbox();
}

/* POS CHECKOUT & CAMERA SCANNING */
function switchSaleSubView(subViewId, btnElement) {
  document.querySelectorAll('.sale-subview-content').forEach(view => {
    view.style.display = 'none';
  });

  document.querySelectorAll('.sale-subtab-btn').forEach(btn => {
    btn.classList.remove('btn-primary', 'active');
    btn.classList.add('btn-secondary');
  });

  const targetView = document.getElementById(subViewId);
  if (targetView) targetView.style.display = 'block';

  if (btnElement) {
    btnElement.classList.remove('btn-secondary');
    btnElement.classList.add('btn-primary', 'active');
  }
}

function toggleCameraScanner() {
  if (isCameraActive) stopCameraScanner();
  else startCameraScanner();
}

function startCameraScanner() {
  if (isCameraActive || isCameraStarting) return;
  if (typeof Html5Qrcode === 'undefined') {
    alert('Camera scanner library not loaded.');
    return;
  }
  const wrapper = document.getElementById('interactive-camera-wrapper');
  const btn = document.getElementById('camToggleBtn');
  isCameraStarting = true;
  if (wrapper) wrapper.style.display = 'block';
  html5QrCode = new Html5Qrcode("reader");

  html5QrCode.start(
    { facingMode: "environment" },
    { fps: 10, qrbox: { width: 250, height: 150 } },
    (decodedText) => {
      const now = Date.now();
      if (decodedText === lastScannedCode && (now - lastScanTime) < 2000) return;
      lastScannedCode = decodedText;
      lastScanTime = now;
      handleCameraScanSuccess(decodedText);
    }
  ).then(() => {
    isCameraStarting = false;
    isCameraActive = true;
    if (btn) {
      btn.textContent = '🛑 Stop Camera';
      btn.className = 'btn btn-danger';
    }
  }).catch(() => {
    isCameraStarting = false;
    isCameraActive = false;
    alert("Camera start failed. Ensure HTTPS or localhost.");
    if (wrapper) wrapper.style.display = 'none';
  });
}

function stopCameraScanner() {
  if (html5QrCode && isCameraActive) {
    html5QrCode.stop().then(() => {
      isCameraActive = false;
      isCameraStarting = false;
      const wrapper = document.getElementById('interactive-camera-wrapper');
      if (wrapper) wrapper.style.display = 'none';
      const btn = document.getElementById('camToggleBtn');
      if (btn) {
        btn.textContent = '📷 Open Live Camera Scanner';
        btn.className = 'btn btn-primary';
      }
    }).catch(() => {
      isCameraActive = false;
      isCameraStarting = false;
    });
  }
}

function handleCameraScanSuccess(scannedCode) {
  const query = scannedCode.trim().toUpperCase();
  const batch = inventoryBatches.find(b => 
    (b.barcode || '').toUpperCase() === query || (b.code || b.variant_code || '').toUpperCase() === query
  );

  if (batch) {
    openConfirmSaleModal(batch.code || batch.variant_code);
  } else {
    alert(`Hindi mahanap ang item para sa Barcode: ${scannedCode}`);
  }
}

function renderSaleGrid() {
  const grid = document.getElementById('saleCatalogGrid');
  if (!grid) return;
  
  const search = (document.getElementById('saleSearchInput')?.value || '').trim().toUpperCase();
  grid.innerHTML = '';

  let matchingVariants = [];

  if (search === "") {
    // ⚠️ AUTOMATIC DISPLAY: Isama ang parehong OUT OF STOCK (stock === 0) at LOW STOCK (stock <= lowStockLimit)
    matchingVariants = inventoryBatches.filter(b => {
      const currentStock = Number(b.stock || 0);
      const limit = Number(b.lowStockLimit || b.low_stock_limit || 0);
      return currentStock === 0 || currentStock <= limit;
    });

    if (matchingVariants.length === 0) {
      grid.innerHTML = `
        <div class="empty-stock-banner">
          <div class="empty-stock-icon">✅</div>
          <div class="empty-stock-title">ALL ITEMS HAVE SUFFICIENT STOCK!</div>
          <div class="empty-stock-sub">
            Walang low stock o out of stock na item. Mag-type o mag-scan ng barcode para mag-checkout.
          </div>
        </div>
      `;
      return;
    }
  } else {
    // SEARCH FILTER: Kapag may tina-type sa search input
    matchingVariants = inventoryBatches.filter(batch => {
      const mId = batch.masterId || batch.master_id;
      const master = masterItems.find(m => Number(m.id) === Number(mId));
      if (!master) return false;

      const bCode = (batch.code || batch.variant_code || '').toUpperCase();
      const bBarcode = (batch.barcode || bCode).toUpperCase();
      const oem = (master.oem || '').toUpperCase();
      const pName = (master.partName || master.part_name || '').toUpperCase();
      const brand = (master.brand || '').toUpperCase();

      return bCode.includes(search) || bBarcode.includes(search) || oem.includes(search) || pName.includes(search) || brand.includes(search);
    });

    if (matchingVariants.length === 0) {
      grid.innerHTML = `
        <div class="empty-stock-banner" style="border-color:#cbd5e1; background:#ffffff;">
          <div class="empty-stock-icon" style="background-color:#f1f5f9; color:#64748b;">🔍</div>
          <div class="empty-stock-title" style="color:#0f172a;">NO MATCHING VARIANTS FOUND</div>
        </div>
      `;
      return;
    }
  }

  // RENDER CARDS FOR MATCHING / CRITICAL VARIANTS
  matchingVariants.forEach(batch => {
    const mId = batch.masterId || batch.master_id;
    const master = masterItems.find(m => Number(m.id) === Number(mId));
    if (!master) return;

    const card = document.createElement('div');
    card.className = 'item-card';
    const bCode = batch.code || batch.variant_code;
    card.onclick = () => openConfirmSaleModal(bCode);

    const stockNum = Number(batch.stock || 0);
    const limitNum = Number(batch.lowStockLimit || batch.low_stock_limit || 0);
    
    let badgeClass = 'stock-green';
    let badgeText = `STOCK: ${stockNum}`;
    
    if (stockNum === 0) {
      badgeClass = 'stock-red';
      badgeText = '0 OUT OF STOCK';
    } else if (stockNum <= limitNum) {
      badgeClass = 'stock-orange';
      badgeText = `⚠️ ${stockNum} LOW STOCK`;
    }

    const images = master.images || master.image_urls || [];
    const hasImages = images.length > 0;
    const pName = master.partName || master.part_name || 'ITEM';

    card.innerHTML = `
      <div>
        <div class="card-img-placeholder ${hasImages ? 'zoomable' : ''}" style="height:70px;">
          ${renderCardMedia(master)}
        </div>
        <div class="item-title">${escapeHtml(pName)} - ${escapeHtml(master.oem)}</div>
        <div class="item-oem">${escapeHtml(master.brand)} | VEHICLE : ${escapeHtml(master.make || '')} ${escapeHtml(master.model || '')}</div>
        <div class="item-subtitle">VARIANT: ${escapeHtml(bCode)} | ${escapeHtml(batch.supplier)}</div>
      </div>
      <div class="card-footer">
        <div class="item-price">₱${Number(batch.price || 0).toFixed(2)}</div>
        <span class="stock-badge ${badgeClass}">${badgeText}</span>
      </div>
    `;
    grid.appendChild(card);
  });
}

function handleSaleBarcodeKey(event) {
  if (event.key === 'Enter') {
    const query = event.target.value.trim().toUpperCase();
    if (!query) return;

    const exactBatch = inventoryBatches.find(b => 
      (b.barcode || '').toUpperCase() === query || (b.code || b.variant_code || '').toUpperCase() === query
    );

    if (exactBatch) {
      openConfirmSaleModal(exactBatch.code || exactBatch.variant_code);
      event.target.value = '';
    } else {
      alert(`Hindi mahanap ang item para sa Barcode/Code: "${query}"`);
    }
  }
}

/* SALES LOG & REPORTS */
function renderSalesLog() {
  const selectedDate = document.getElementById('salesDateFilter').value || getTodayString();
  const tbody = document.getElementById('salesLogTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const filteredTxns = salesTransactions.filter(t => (t.date || '').startsWith(selectedDate));
  let grossSum = 0, costSum = 0, profitSum = 0, totalPcs = 0;

  if (filteredTxns.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#94a3b8; padding:20px;">Walang naitalang benta sa petsang ito.</td></tr>`;
  } else {
    filteredTxns.forEach(txn => {
      const gTotal = Number(txn.grandTotal || txn.grand_total || 0);
      const cTotal = Number(txn.totalCost || txn.total_cost || 0);
      const pTotal = Number(txn.totalProfit || txn.total_profit || 0);
      grossSum += gTotal;
      costSum += cTotal;
      profitSum += pTotal;

      const items = txn.items || txn.transaction_items || [];
      items.forEach(i => {
        const qty = Number(i.qty || i.quantity || 0);
        totalPcs += qty;
        const price = Number(i.price || 0);
        const cost = Number(i.cost || 0);
        const pName = i.partName || i.part_name || 'ITEM';
        const oem = i.oem || '';

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong>${escapeHtml(txn.time || '')}</strong><br><small>${escapeHtml(txn.id || txn.transaction_id)}</small></td>
          <td>• ${escapeHtml(pName)} (${escapeHtml(oem)})</td>
          <td style="text-align:center; font-weight:bold;">${qty}</td>
          <td style="text-align:right; color:#ea580c;">₱${(cost * qty).toFixed(2)}</td>
          <td style="text-align:right; font-weight:bold; color:#2563eb;">₱${(price * qty).toFixed(2)}</td>
          <td style="text-align:right; font-weight:bold; color:#16a34a;">₱${((price - cost) * qty).toFixed(2)}</td>
        `;
        tbody.appendChild(tr);
      });
    });
  }

  document.getElementById('salesGrossTotal').textContent = `₱${grossSum.toFixed(2)}`;
  document.getElementById('salesCostTotal').textContent = `₱${costSum.toFixed(2)}`;
  document.getElementById('salesProfitTotal').textContent = `₱${profitSum.toFixed(2)}`;
  document.getElementById('salesTxnCount').textContent = filteredTxns.length;
  document.getElementById('salesItemsCount').textContent = `${totalPcs} total pcs sold`;
}

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
    html += ` ➔ <span class="crumb-active">📄 ${currentSelectedDate} Details</span>`;
  }
  container.innerHTML = html;
}

function goToYearlyView() {
  activeReportLevel = 'yearly';
  renderReportsModule();
}

function goToMonthlyView(mCode) {
  if (mCode) currentSelectedMonth = mCode;
  activeReportLevel = 'monthly';
  const monthSelect = document.getElementById('rptMonthSelect');
  if (monthSelect) monthSelect.value = currentSelectedMonth;
  renderReportsModule();
}

function goToDailyView(dateStr) {
  if (dateStr) currentSelectedDate = dateStr;
  activeReportLevel = 'daily';
  renderReportsModule();
}

function renderYearlyReport() {
  const yearSelect = document.getElementById('rptYearSelect');
  if (yearSelect) currentSelectedYear = yearSelect.value;
  const tbody = document.getElementById('yearlyTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';
  let yrSales = 0, yrCost = 0, yrProfit = 0;

  for (let m = 1; m <= 12; m++) {
    const mCode = String(m).padStart(2, '0');
    const prefix = `${currentSelectedYear}-${mCode}`;
    const mTxns = salesTransactions.filter(t => (t.date || '').startsWith(prefix));
    const mSales = mTxns.reduce((sum, t) => sum + Number(t.grandTotal || t.grand_total || 0), 0);
    const mCost = mTxns.reduce((sum, t) => sum + Number(t.totalCost || t.total_cost || 0), 0);
    const mProfit = mTxns.reduce((sum, t) => sum + Number(t.totalProfit || t.total_profit || 0), 0);

    yrSales += mSales; yrCost += mCost; yrProfit += mProfit;
    const tr = document.createElement('tr');
    tr.className = 'clickable-row';
    tr.onclick = () => goToMonthlyView(mCode);
    tr.innerHTML = `
      <td><strong>${monthNames[m - 1]} ${currentSelectedYear}</strong></td>
      <td style="text-align:center;">${mTxns.length}</td>
      <td style="text-align:right; color:#ea580c;">₱${mCost.toFixed(2)}</td>
      <td style="text-align:right; font-weight:bold; color:#2563eb;">₱${mSales.toFixed(2)}</td>
      <td style="text-align:right; font-weight:bold; color:#16a34a;">₱${mProfit.toFixed(2)}</td>
      <td style="text-align:center;"><button class="btn btn-secondary" style="font-size:10px;">View ➔</button></td>
    `;
    tbody.appendChild(tr);
  }
  document.getElementById('yrGrossSales').textContent = `₱${yrSales.toFixed(2)}`;
  document.getElementById('yrTotalCost').textContent = `₱${yrCost.toFixed(2)}`;
  document.getElementById('yrNetProfit').textContent = `₱${yrProfit.toFixed(2)}`;
}

function handleMonthSelectChange() {
  const monthSelect = document.getElementById('rptMonthSelect');
  if (monthSelect) currentSelectedMonth = monthSelect.value;
  renderMonthlyReport();
}

function renderMonthlyReport() {
  renderBreadcrumbs();
  const mName = monthNames[parseInt(currentSelectedMonth) - 1];
  document.getElementById('monthlyTitleHeader').textContent = `📆 Monthly Breakdown — ${mName} ${currentSelectedYear}`;
  const tbody = document.getElementById('monthlyTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const daysInMonth = new Date(parseInt(currentSelectedYear), parseInt(currentSelectedMonth), 0).getDate();
  let mnSales = 0, mnCost = 0, mnProfit = 0;

  for (let day = 1; day <= daysInMonth; day++) {
    const dayStr = String(day).padStart(2, '0');
    const fullDate = `${currentSelectedYear}-${currentSelectedMonth}-${dayStr}`;
    const dayTxns = salesTransactions.filter(t => (t.date || '') === fullDate);
    const dSales = dayTxns.reduce((sum, t) => sum + Number(t.grandTotal || t.grand_total || 0), 0);
    const dCost = dayTxns.reduce((sum, t) => sum + Number(t.totalCost || t.total_cost || 0), 0);
    const dProfit = dayTxns.reduce((sum, t) => sum + Number(t.totalProfit || t.total_profit || 0), 0);

    mnSales += dSales; mnCost += dCost; mnProfit += dProfit;
    const tr = document.createElement('tr');
    if (dayTxns.length > 0) {
      tr.className = 'clickable-row';
      tr.onclick = () => goToDailyView(fullDate);
    }
    tr.innerHTML = `
      <td><strong>${fullDate}</strong></td>
      <td style="text-align:center;">${dayTxns.length}</td>
      <td style="text-align:right; color:#ea580c;">₱${dCost.toFixed(2)}</td>
      <td style="text-align:right; font-weight:bold; color:#2563eb;">₱${dSales.toFixed(2)}</td>
      <td style="text-align:right; font-weight:bold; color:#16a34a;">₱${dProfit.toFixed(2)}</td>
      <td style="text-align:center;">${dayTxns.length > 0 ? '<button class="btn btn-primary" style="font-size:10px;">Details ➔</button>' : '<span style="color:#94a3b8;">No Sales</span>'}</td>
    `;
    tbody.appendChild(tr);
  }
  document.getElementById('mnGrossSales').textContent = `₱${mnSales.toFixed(2)}`;
  document.getElementById('mnTotalCost').textContent = `₱${mnCost.toFixed(2)}`;
  document.getElementById('mnNetProfit').textContent = `₱${mnProfit.toFixed(2)}`;
}

function renderDailyReport() {
  renderBreadcrumbs();
  document.getElementById('dailyTitleHeader').textContent = `📄 Daily Items Sales Log — ${currentSelectedDate}`;
  const tbody = document.getElementById('dailyTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';
  const dayTxns = salesTransactions.filter(t => (t.date || '') === currentSelectedDate);
  let dySales = 0, dyCost = 0, dyProfit = 0;

  if (dayTxns.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#94a3b8; padding:20px;">Walang naitalang benta sa araw na ito.</td></tr>`;
  } else {
    dayTxns.forEach(txn => {
      dySales += Number(txn.grandTotal || txn.grand_total || 0);
      dyCost += Number(txn.totalCost || txn.total_cost || 0);
      dyProfit += Number(txn.totalProfit || txn.total_profit || 0);

      const items = txn.items || txn.transaction_items || [];
      items.forEach(i => {
        const qty = Number(i.qty || i.quantity || 0);
        const price = Number(i.price || 0);
        const cost = Number(i.cost || 0);
        const pName = i.partName || i.part_name || 'ITEM';
        const oem = i.oem || '';

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong>${escapeHtml(txn.time || '')}</strong><br><small>${escapeHtml(txn.id || txn.transaction_id)}</small></td>
          <td>• ${escapeHtml(pName)} (${escapeHtml(oem)})</td>
          <td style="text-align:center; font-weight:bold;">${qty}</td>
          <td style="text-align:right; color:#ea580c;">₱${(cost * qty).toFixed(2)}</td>
          <td style="text-align:right; font-weight:bold; color:#2563eb;">₱${(price * qty).toFixed(2)}</td>
          <td style="text-align:right; font-weight:bold; color:#16a34a;">₱${((price - cost) * qty).toFixed(2)}</td>
        `;
        tbody.appendChild(tr);
      });
    });
  }
  document.getElementById('dyGrossSales').textContent = `₱${dySales.toFixed(2)}`;
  document.getElementById('dyTotalCost').textContent = `₱${dyCost.toFixed(2)}`;
  // INAYOS NA ANG SYNTAX ERROR DITO:
  document.getElementById('dyNetProfit').textContent = `₱${dyProfit.toFixed(2)}`;
}

/* SUPPLIER MANAGEMENT */
async function renderSuppliersTable() {
  try {
    registeredSuppliers = await apiRequest('/suppliers', 'GET');
    const tbody = document.getElementById('suppliersTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (registeredSuppliers.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#94a3b8; padding:16px;">No suppliers registered yet.</td></tr>`;
      return;
    }

    registeredSuppliers.forEach(s => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>#SUP-${String(s.id).padStart(3, '0')}</strong></td>
        <td><strong>${escapeHtml(s.name)}</strong></td>
        <td>${escapeHtml(s.contact_person)}</td>
        <td>${escapeHtml(s.phone)}</td>
        <td>${escapeHtml(s.email)}</td>
        <td style="text-align:center;">
          <button class="btn btn-danger" style="font-size:10px; padding:3px 8px;" onclick="deleteSupplier(${s.id})">🗑️ Delete</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
    updateSupplierDropdowns();
  } catch (err) {
    console.error('Failed to load suppliers:', err);
  }
}

async function handleRegisterSupplierSubmit(event) {
  event.preventDefault();

  const name = document.getElementById('suppNameInput').value.trim();
  const contactPerson = document.getElementById('suppContactPersonInput').value.trim();
  const phone = document.getElementById('suppPhoneInput').value.trim();
  const email = document.getElementById('suppEmailInput').value.trim();

  try {
    await apiRequest('/suppliers', 'POST', { name, contactPerson, phone, email });
    document.getElementById('supplierRegForm').reset();
    await renderSuppliersTable();
    alert(`✅ Bagong supplier na si ${name} ay matagumpay na nairehistro!`);
  } catch (err) {
    alert(`❌ Error: ${err.message}`);
  }
}

async function deleteSupplier(suppId) {
  if (confirm('Sigurado ka bang gusto mong burahin ang supplier na ito?')) {
    try {
      await apiRequest(`/suppliers/${suppId}`, 'DELETE');
      await renderSuppliersTable();
      alert('✅ Supplier deleted successfully!');
    } catch (err) {
      alert(`❌ Error: ${err.message}`);
    }
  }
}

function updateSupplierDropdowns() {
  const selectEl = document.getElementById('qSupplierInput');
  if (!selectEl) return;
  
  const currentVal = selectEl.value;
  selectEl.innerHTML = `<option value="">SELECT SUPPLIER...</option>`;
  
  registeredSuppliers.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.name;
    opt.textContent = s.name;
    selectEl.appendChild(opt);
  });

  if (currentVal) selectEl.value = currentVal;
}

/* USER MANAGEMENT */
function renderUsersTable() {
  const tbody = document.getElementById('usersTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  systemUsers.forEach(u => {
    const tr = document.createElement('tr');
    const roleClass = u.role === 'ADMIN' ? 'stock-red' : (u.role === 'MANAGER' ? 'stock-green' : 'stock-orange');
    tr.innerHTML = `
      <td><strong>#USR-${String(u.id || '').padStart(3, '0')}</strong></td>
      <td><strong>${escapeHtml(u.fullName || u.full_name)}</strong></td>
      <td><code>${escapeHtml(u.username)}</code></td>
      <td style="text-align:center;"><span class="stock-badge ${roleClass}">${escapeHtml(u.role)}</span></td>
      <td style="text-align:center;">${u.role === 'ADMIN' ? '<small style="color:#94a3b8;">Protected</small>' : `<button class="btn btn-danger" style="font-size:10px; padding:2px 6px;" onclick="deleteSystemUser(${u.id})">🗑️ Delete</button>`}</td>
    `;
    tbody.appendChild(tr);
  });
}

async function handleRegisterUserSubmit(event) {
  event.preventDefault();
  
  const fullNameInput = document.getElementById('userFullNameInput');
  const usernameInput = document.getElementById('userUsernameInput');
  const passwordInput = document.getElementById('userPasswordInput');
  const roleSelect = document.getElementById('userRoleSelect');

  const fullName = fullNameInput ? fullNameInput.value.trim() : '';
  const username = usernameInput ? usernameInput.value.trim() : '';
  const password = passwordInput ? passwordInput.value : '';
  const role = roleSelect ? roleSelect.value : '';

  if (!fullName || !username || !password || !role) {
    alert('⚠️ Mangyaring punan ang lahat ng kinakailangang impormasyon.');
    return;
  }

  try {
    const response = await apiRequest('/users', 'POST', { fullName, username, password, role });
    alert(`✅ Bagong account para kay ${response.full_name || fullName} ay matagumpay na nairehistro!`);
    document.getElementById('userRegForm').reset();
    await loadProductionDataFromBackend();
    renderUsersTable();
  } catch (err) {
    alert(`❌ Nabigong magrehistro ng user: ${err.message}`);
  }
}

async function deleteSystemUser(userId) {
  if (confirm('Sigurado ka bang gusto mong burahin ang account na ito?')) {
    try {
      await apiRequest(`/users/${userId}`, 'DELETE');
      await loadProductionDataFromBackend();
      renderUsersTable();
    } catch (err) {
      console.error("Delete user error:", err);
      alert('Nabigong burahin ang user.');
    }
  }
}

/* INITIALIZATION ON DOM LOAD */
document.addEventListener('DOMContentLoaded', () => {
  const dateFilter = document.getElementById('salesDateFilter');
  if (dateFilter) dateFilter.value = getTodayString();
  renderSaleGrid();
});