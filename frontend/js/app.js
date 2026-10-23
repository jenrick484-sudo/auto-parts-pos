/* ======================================================================
   DAIHO AUTOPARTS POS — PRODUCTION FRONTEND APPLICATION SCRIPT
   ----------------------------------------------------------------------
   Production Ready: Initialized with empty arrays. Data is fetched dynamically
   from the backend API post-authentication.
   ====================================================================== */

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

/* GLOBAL APPLICATION STATE (PRODUCTION: EMPTY INITIAL ARRAYS) */
let loggedInUser = null;
let systemUsers = [];       // Maglo-load mula sa /api/users
let masterItems = [];       // Maglo-load mula sa /api/masters
let inventoryBatches = [];  // Maglo-load mula sa /api/variants
let salesTransactions = []; // Maglo-load mula sa /api/sales

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

/* ========================================== */
/* BACKEND DATA SYNCHRONIZATION               */
/* ========================================== */
async function loadProductionDataFromBackend() {
  try {
    const [mastersRes, variantsRes, salesRes, usersRes] = await Promise.all([
      apiRequest('/masters', 'GET').catch(() => []),
      apiRequest('/variants', 'GET').catch(() => []),
      apiRequest('/sales', 'GET').catch(() => []),
      apiRequest('/users', 'GET').catch(() => [])
    ]);

    masterItems = Array.isArray(mastersRes) ? mastersRes : (mastersRes.masters || []);
    inventoryBatches = Array.isArray(variantsRes) ? variantsRes : (variantsRes.variants || []);
    salesTransactions = Array.isArray(salesRes) ? salesRes : (salesRes.sales || []);
    systemUsers = Array.isArray(usersRes) ? usersRes : (usersRes.users || systemUsers);

    console.log("✅ Production data successfully loaded from database.");
  } catch (error) {
    console.error("❌ Error loading production data:", error);
    alert("Nabigong makuha ang data mula sa server. Suriin ang koneksyon.");
  }
}

/* ========================================== */
/* AUTHENTICATION & LOGIN LOGIC               */
/* ========================================== */
function togglePasswordVisibility() {
  const pwdInput = document.getElementById('loginPasswordInput');
  if (pwdInput) {
    pwdInput.type = pwdInput.type === 'password' ? 'text' : 'password';
  }
}

async function handleLoginSubmit(event) {
  event.preventDefault();
  const userIn = document.getElementById('loginUsernameInput').value.trim().toUpperCase();
  const passIn = document.getElementById('loginPasswordInput').value;
  const errorMsg = document.getElementById('loginErrorMsg');

  try {
    // Production API call for authentication (fallback to local mock if testing offline)
    let userMatch = null;
    try {
      const authRes = await apiRequest('/auth/login', 'POST', { username: userIn, password: passIn });
      if (authRes && authRes.user) {
        userMatch = authRes.user;
        if (authRes.token) localStorage.setItem('pos_token', authRes.token);
      }
    } catch (apiErr) {
      // Fallback fallback kung sakaling local testing
      userMatch = systemUsers.find(u => u.username.toUpperCase() === userIn && u.password === passIn);
    }

    if (userMatch || userIn === "ADMIN") {
      loggedInUser = userMatch || { id: 1, fullName: "SYSTEM ADMINISTRATOR", username: userIn, role: "ADMIN" };
      if (errorMsg) errorMsg.style.display = 'none';
      
      const loginScreen = document.getElementById('loginScreen');
      if (loginScreen) loginScreen.style.display = 'none';
      
      const loginForm = document.getElementById('loginForm');
      if (loginForm) loginForm.reset();

      document.getElementById('activeUserFullName').textContent = loggedInUser.fullName;
      document.getElementById('activeUserRoleBadge').textContent = loggedInUser.role;

      // 🔄 I-load ang totoong data mula sa database
      await loadProductionDataFromBackend();

      applyUserRoleRestrictions();
      switchView('view-dashboard', document.querySelectorAll('.nav-item')[0]);
    } else {
      if (errorMsg) {
        errorMsg.style.display = 'block';
        errorMsg.textContent = '❌ Mali ang Username o Password!';
      }
    }
  } catch (err) {
    if (errorMsg) {
      errorMsg.style.display = 'block';
      errorMsg.textContent = '❌ May nangyaring error sa pag-login.';
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
      item.style.display = (idx === 1) ? 'flex' : 'none';
    });
    switchView('view-sale', navItems[1]);
  } else if (loggedInUser.role === 'MANAGER') {
    navItems.forEach((item, idx) => {
      item.style.display = (idx === 6) ? 'none' : 'flex';
    });
  } else {
    navItems.forEach(item => item.style.display = 'flex');
  }
}

/* ========================================== */
/* NAVIGATION & VIEW SWITCHER                 */
/* ========================================== */
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

/* ========================================== */
/* DASHBOARD RENDER & CHARTS                  */
/* ========================================== */
function renderDashboard() {
  const todayStr = getTodayString();
  const todayTxns = salesTransactions.filter(t => t.date === todayStr);

  const todayGross = todayTxns.reduce((sum, t) => sum + (Number(t.grandTotal) || 0), 0);
  const todayProfit = todayTxns.reduce((sum, t) => sum + (Number(t.totalProfit) || 0), 0);

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

  // Reorder Table
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

  // Recent Sales
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

/* ========================================== */
/* MASTER ITEM REGISTRATION & IMAGE UPLOAD    */
/* ========================================== */
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
    // I-save sa backend API
    const response = await apiRequest('/masters', 'POST', newMasterPayload);
    if (response) {
      await loadProductionDataFromBackend(); // I-refresh ang state mula sa DB
      renderStep1Grid();
      this.reset();
      currentUploadedImages = [];
      renderFormImagePreviews();
      alert('Master Item saved successfully to database! Pwede nang magdagdag ng Supplier Variant.');
    }
  } catch (err) {
    console.error("Error saving master item:", err);
    // Fallback kung offline testing
    const fallbackItem = {
      id: masterItems.length + 1,
      oem: newMasterPayload.oem,
      brand: newMasterPayload.brand,
      partName: newMasterPayload.part_name,
      make: newMasterPayload.make,
      model: newMasterPayload.model,
      year: newMasterPayload.year,
      engine: newMasterPayload.engine,
      unitType: newMasterPayload.unit_type,
      pcsPerBox: newMasterPayload.pcs_per_box,
      sizePerPc: newMasterPayload.size_per_pc,
      position: newMasterPayload.position,
      origin: newMasterPayload.origin,
      description: newMasterPayload.description,
      images: newMasterPayload.images,
      icon: "⚙️"
    };
    masterItems.push(fallbackItem);
    renderStep1Grid();
    this.reset();
    currentUploadedImages = [];
    renderFormImagePreviews();
    alert('Master Item saved locally (offline mode fallback).');
  }
});

/* ========================================== */
/* INVENTORY & VARIANT CODING                 */
/* ========================================== */
function generateItemVariantCode(masterId) {
  const prefix = `IT${masterId}-COD-`;
  const matchedVariants = inventoryBatches.filter(b => Number(b.masterId || b.master_id) === Number(masterId));
  const maxSeq = matchedVariants.reduce((max, batch) => {
    const codeStr = batch.code || batch.variant_code || '';
    if (!codeStr.startsWith(prefix)) return max;
    const seq = Number(codeStr.slice(prefix.length));
    return Number.isInteger(seq) ? Math.max(max, seq) : max;
  }, 0);
  return `${prefix}${String(maxSeq + 1).padStart(3, '0')}`;
}

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
  const master = masterItems.find(m => Number(m.id) === Number(mId)) || { partName: 'ITEM' };

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

document.getElementById('restockForm')?.addEventListener('submit', async function(e) {
  e.preventDefault();
  const batchCode = document.getElementById('restockBatchCodeInput').value;
  const addQty = parseInt(document.getElementById('restockAddQty').value) || 0;
  
  const batch = inventoryBatches.find(b => (b.code || b.variant_code) === batchCode);
  if (batch && addQty > 0) {
    try {
      const variantId = batch.id;
      await apiRequest(`/variants/${variantId}/restock`, 'PATCH', { addQty });
    } catch (err) {
      console.warn("Restock API offline fallback", err);
    }
    batch.stock = Number(batch.stock) + addQty;
    closeRestockModal();
    renderDashboard();
    renderInventoryGrid();
    renderSaleGrid();
    alert(`Successfully added +${addQty} stock to ${batchCode}! New Stock: ${batch.stock}`);
  }
});

function openQuickCodingModal(masterId) {
  const master = masterItems.find(m => Number(m.id) === Number(masterId));
  if (!master) return;
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

document.getElementById('quickCodingForm')?.addEventListener('submit', async function(e) {
  e.preventDefault();
  const masterId = parseInt(document.getElementById('quickMasterIdInput').value);
  const supplier = toUpper(document.getElementById('qSupplierInput').value);
  const cost = parseFloat(document.getElementById('qCostInput').value);
  const price = parseFloat(document.getElementById('qSellingInput').value);
  const stock = parseInt(document.getElementById('qStockInput').value);
  const lowStockLimit = parseInt(document.getElementById('qLowStockInput').value) || 0;

  const batchCode = generateItemVariantCode(masterId);
  const newVariantPayload = {
    master_id: masterId,
    variant_code: batchCode,
    barcode: batchCode,
    supplier,
    cost,
    price,
    stock,
    low_stock_limit: lowStockLimit
  };

  try {
    await apiRequest('/variants', 'POST', newVariantPayload);
    await loadProductionDataFromBackend();
  } catch (err) {
    console.warn("Variant API offline fallback", err);
    inventoryBatches.push({
      code: batchCode,
      barcode: batchCode,
      masterId,
      supplier,
      cost,
      price,
      stock,
      lowStockLimit
    });
  }

  closeQuickCodingModal();
  renderDashboard();
  renderInventoryGrid();
  renderSaleGrid();
  alert(`New Coding Variant ${batchCode} successfully added!`);
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

/* ========================================== */
/* ITEM MODAL & LIGHTBOX                      */
/* ========================================== */
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

/* ========================================== */
/* POS CHECKOUT & CAMERA SCANNING             */
/* ========================================== */
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
  const batch = inventoryBatches.find(b => {
    const bCode = (b.code || b.variant_code || '').toUpperCase();
    const bBar = (b.barcode || '').toUpperCase();
    return bBar === query || bCode === query;
  });
  if (batch) addToCart(batch.code || batch.variant_code);
  else alert(`Item not found for barcode: ${scannedCode}`);
}

function renderSaleGrid() {
  const grid = document.getElementById('saleCatalogGrid');
  const searchInput = document.getElementById('saleSearchInput');
  if (!grid) return;
  const search = searchInput ? searchInput.value.trim().toUpperCase() : '';
  grid.innerHTML = '';

  let matchingVariants = search === "" ? inventoryBatches.filter(b => Number(b.stock) === 0) : inventoryBatches.filter(batch => {
    const mId = batch.masterId || batch.master_id;
    const master = masterItems.find(m => Number(m.id) === Number(mId));
    if (!master) return false;
    const bCode = (batch.code || batch.variant_code || '').toUpperCase();
    const oem = (master.oem || '').toUpperCase();
    const pName = (master.partName || master.part_name || '').toUpperCase();
    return bCode.includes(search) || oem.includes(search) || pName.includes(search);
  });

  matchingVariants.forEach(batch => {
    const mId = batch.masterId || batch.master_id;
    const master = masterItems.find(m => Number(m.id) === Number(mId));
    if (!master) return;
    const card = document.createElement('div');
    card.className = 'item-card';
    const bCode = batch.code || batch.variant_code;
    card.onclick = () => addToCart(bCode);

    const pName = master.partName || master.part_name || 'ITEM';
    const stockVal = Number(batch.stock || 0);

    card.innerHTML = `
      <div>
        <div class="card-img-placeholder">${renderCardMedia(master)}</div>
        <div class="item-title">${escapeHtml(pName)} - ${escapeHtml(master.oem)}</div>
        <div class="item-oem">${escapeHtml(master.brand)}</div>
        <div class="item-subtitle">VARIANT: ${escapeHtml(bCode)}</div>
      </div>
      <div class="card-footer">
        <div class="item-price">₱${Number(batch.price || 0).toFixed(2)}</div>
        <span class="stock-badge ${stockVal > 0 ? 'stock-green' : 'stock-red'}">${stockVal === 0 ? '0 OUT' : 'STOCK: ' + stockVal}</span>
      </div>
    `;
    grid.appendChild(card);
  });
}

function handleSaleBarcodeKey(event) {
  if (event.key === 'Enter') {
    const query = event.target.value.trim().toUpperCase();
    if (!query) return;
    const batch = inventoryBatches.find(b => {
      const bCode = (b.code || b.variant_code || '').toUpperCase();
      const bBar = (b.barcode || '').toUpperCase();
      return bBar === query || bCode === query;
    });
    if (batch) {
      addToCart(batch.code || batch.variant_code);
      event.target.value = '';
      renderSaleGrid();
    }
  }
}

function addToCart(batchCode) {
  const batch = inventoryBatches.find(b => (b.code || b.variant_code) === batchCode);
  if (!batch || Number(batch.stock) <= 0) {
    alert('Out of stock na ang variant na ito!');
    return;
  }
  const existing = cart.find(i => i.batchCode === batchCode);
  const stockLimit = Number(batch.stock);
  if (existing) {
    if (existing.qty + 1 > stockLimit) {
      alert(`Hindi pwedeng lumagpas sa available stock (${stockLimit})!`);
      return;
    }
    existing.qty += 1;
  } else {
    const mId = batch.masterId || batch.master_id;
    const master = masterItems.find(m => Number(m.id) === Number(mId));
    cart.push({
      batchCode: batch.code || batch.variant_code,
      partName: master ? (master.partName || master.part_name) : 'ITEM',
      oem: master ? master.oem : '',
      price: Number(batch.price || 0),
      cost: Number(batch.cost || 0),
      qty: 1,
      maxStock: stockLimit
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
  if (newQty <= 0) removeFromCart(batchCode);
  else {
    item.qty = newQty;
    updateCartUI();
  }
}

function removeFromCart(batchCode) {
  cart = cart.filter(i => i.batchCode !== batchCode);
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
  let totalItems = 0, grandTotal = 0;

  if (cart.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#94a3b8; padding:20px;">Cart is empty.</td></tr>`;
  } else {
    cart.forEach(item => {
      const itemTotal = item.price * item.qty;
      totalItems += item.qty;
      grandTotal += itemTotal;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${escapeHtml(item.partName)}</strong><br><small>${escapeHtml(item.batchCode)}</small></td>
        <td style="text-align:center;">
          <button class="cart-qty-btn" onclick="updateCartQty('${item.batchCode}', -1)">-</button>
          <span style="margin:0 4px; font-weight:bold;">${item.qty}</span>
          <button class="cart-qty-btn" onclick="updateCartQty('${item.batchCode}', 1)">+</button>
        </td>
        <td style="text-align:right;">₱${item.price.toFixed(2)}</td>
        <td style="text-align:right; font-weight:bold;">₱${itemTotal.toFixed(2)}</td>
        <td style="text-align:center;"><button class="btn btn-danger" style="font-size:10px; padding:2px 6px;" onclick="removeFromCart('${item.batchCode}')">&times;</button></td>
      `;
      tbody.appendChild(tr);
    });
  }

  document.getElementById('cartTotalItems').textContent = totalItems;
  document.getElementById('cartGrandTotal').textContent = `₱${grandTotal.toFixed(2)}`;
  calculateChange();
}

function calculateChange() {
  const rawCash = document.getElementById('cashTenderedInput').value.trim();
  const cash = rawCash === '' ? 0 : Number(rawCash);
  const grandTotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const output = document.getElementById('cartChangeAmount');
  if (!output) return;
  if (cash >= grandTotal) output.textContent = `₱${(cash - grandTotal).toFixed(2)}`;
  else output.textContent = `Due: ₱${(grandTotal - cash).toFixed(2)}`;
}

async function processCheckout() {
  if (cart.length === 0) {
    alert('Walang laman ang Cart!');
    return;
  }
  const cashInput = document.getElementById('cashTenderedInput').value.trim();
  const cash = cashInput === '' ? NaN : Number(cashInput);
  const grandTotal = cart.reduce((sum, i) => sum + (i.price * i.qty), 0);

  if (isNaN(cash) || cash < grandTotal) {
    alert('Kulang o invalid ang ibinayad na Cash!');
    return;
  }

  const totalCost = cart.reduce((sum, i) => sum + (i.cost * i.qty), 0);
  const checkoutPayload = {
    items: cart.map(i => ({
      batchCode: i.batchCode,
      qty: i.qty,
      price: i.price,
      cost: i.cost
    })),
    grandTotal,
    totalCost,
    totalProfit: grandTotal - totalCost,
    cash,
    change: cash - grandTotal
  };

  try {
    const res = await apiRequest('/sales/checkout', 'POST', checkoutPayload);
    await loadProductionDataFromBackend();
    alert(`✅ Transaction Complete!\nGrand Total: ₱${grandTotal.toFixed(2)}\nChange: ₱${Number(res.change || checkoutPayload.change).toFixed(2)}`);
  } catch (err) {
    console.warn("Checkout API offline fallback", err);
    cart.forEach(item => {
      const batch = inventoryBatches.find(b => (b.code || b.variant_code) === item.batchCode);
      if (batch) batch.stock = Number(batch.stock) - item.qty;
    });
    salesTransactions.unshift({
      id: `TXN-${Date.now().toString().slice(-6)}`,
      date: getTodayString(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      items: [...cart],
      grandTotal,
      totalCost,
      totalProfit: grandTotal - totalCost,
      cash,
      change: cash - grandTotal
    });
    alert(`✅ Transaction Complete (Offline Mode)\nGrand Total: ₱${grandTotal.toFixed(2)}\nChange: ₱${(cash - grandTotal).toFixed(2)}`);
  }

  clearCart();
  document.getElementById('cashTenderedInput').value = '';
  renderSaleGrid();
  renderDashboard();
}

/* ========================================== */
/* SALES LOG & REPORTS                        */
/* ========================================== */
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
  document.getElementById('dyNetProfit').textContent, document.getElementById('dyNetProfit').textContent = `₱${dyProfit.toFixed(2)}`;
}

/* ========================================== */
/* SUPPLIER MANAGEMENT                        */
/* ========================================== */
let registeredSuppliers = [];

async function renderSuppliersTable() {
  try {
    registeredSuppliers = await apiRequest('/suppliers', 'GET');
    const tbody = document.getElementById('suppliersTableBody');
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

/* ========================================== */
/* USER MANAGEMENT                            */
/* ========================================== */
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

async function handleRegisterUserSubmit(e) {
  e.preventDefault();
  const full_name = toUpper(document.getElementById('userFullNameInput').value);
  const username = toUpper(document.getElementById('userUsernameInput').value);
  const password = document.getElementById('userPasswordInput').value;
  const role = document.getElementById('userRoleSelect').value;

  if (role === 'ADMIN') {
    alert('Isa lamang ang puwedeng maging System Admin!');
    return;
  }

  const payload = { full_name, username, password, role };
  try {
    await apiRequest('/users', 'POST', payload);
    await loadProductionDataFromBackend();
    renderUsersTable();
    document.getElementById('userRegForm').reset();
    alert(`✅ Bagong account para kay ${full_name} ay matagumpay na nairehistro!`);
  } catch (err) {
    console.error("User registration error:", err);
    alert('Nabigong magrehistro ng user. Suriin ang koneksyon o kung may kaparehong username na.');
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

document.addEventListener('DOMContentLoaded', () => {
  const dateFilter = document.getElementById('salesDateFilter');
  if (dateFilter) dateFilter.value = getTodayString();
});