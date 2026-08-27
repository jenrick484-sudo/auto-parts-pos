let loggedInUser = JSON.parse(localStorage.getItem('pos_user')) || null;
let cart = [];

// 1. AUTHENTICATION (LOGIN)
async function handleLoginSubmit(event) {
  event.preventDefault();
  const username = document.getElementById('loginUsernameInput').value.trim();
  const password = document.getElementById('loginPasswordInput').value;

  try {
    const res = await apiRequest('/auth/login', 'POST', { username, password });
    
    // Save Session to LocalStorage
    localStorage.setItem('pos_token', res.token);
    localStorage.setItem('pos_user', JSON.stringify(res.user));
    loggedInUser = res.user;

    document.getElementById('loginErrorMsg').style.display = 'none';
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('loginForm').reset();

    document.getElementById('activeUserFullName').textContent = loggedInUser.fullName;
    document.getElementById('activeUserRoleBadge').textContent = loggedInUser.role;

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
    document.getElementById('loginScreen').style.display = 'flex';
  }
}

// 2. FETCH MASTER ITEMS & VARIANTS FOR POS CATALOG
async function renderSaleGrid() {
  const grid = document.getElementById('saleCatalogGrid');
  const search = document.getElementById('saleSearchInput').value.trim().toUpperCase();

  try {
    const variants = await apiRequest('/variants');
    grid.innerHTML = '';

    const filtered = variants.filter(b => 
      b.code.includes(search) || 
      b.barcode.includes(search) || 
      b.part_name.includes(search) || 
      b.oem.includes(search)
    );

    filtered.forEach(batch => {
      const card = document.createElement('div');
      card.className = 'item-card';
      card.onclick = () => addToCart(batch);

      const badgeClass = batch.stock > 0 ? 'stock-green' : 'stock-red';

      card.innerHTML = `
        <div>
          <div class="card-img-placeholder">⚙️</div>
          <div class="item-title">${batch.part_name} - ${batch.oem}</div>
          <div class="item-oem">${batch.brand} | SUPPLIER: ${batch.supplier}</div>
          <div class="item-subtitle">VARIANT: ${batch.code}</div>
        </div>
        <div class="card-footer">
          <div class="item-price">₱${parseFloat(batch.price).toFixed(2)}</div>
          <span class="stock-badge ${badgeClass}">${batch.stock === 0 ? '0 OUT OF STOCK' : 'STOCK: ' + batch.stock}</span>
        </div>
      `;
      grid.appendChild(card);
    });
  } catch (err) {
    grid.innerHTML = `<p style="color:red;">Failed to load inventory: ${err.message}</p>`;
  }
}

// 3. POS CHECKOUT PROCESS
async function processCheckout() {
  if (cart.length === 0) return alert('Walang laman ang Cart!');

  const grandTotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const totalCost = cart.reduce((sum, item) => sum + (item.cost * item.qty), 0);
  const cash = parseFloat(document.getElementById('cashTenderedInput').value) || 0;

  if (cash < grandTotal) return alert('Kulang ang ibinayad na Cash!');

  try {
    const payload = {
      cart,
      cash,
      grandTotal,
      totalCost,
      change: cash - grandTotal
    };

    const res = await apiRequest('/sales/checkout', 'POST', payload);

    alert(`✅ Transaction Complete!\nTxn No: ${res.txnNumber}\nTotal: ₱${grandTotal.toFixed(2)}\nChange: ₱${res.change.toFixed(2)}`);

    cart = [];
    updateCartUI();
    document.getElementById('cashTenderedInput').value = '';
    renderSaleGrid();
  } catch (err) {
    alert(`❌ Checkout Failed: ${err.message}`);
  }
}