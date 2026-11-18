/* ============================================================================
   GLOBAL LOADING SPINNER (OPTIMIZED WITH REQUEST COUNTER)
   ============================================================================ */

let activeRequestsCount = 0;

function showLoading() {
  activeRequestsCount++;
  const spinnerEl = document.getElementById('globalLoadingSpinner');
  if (spinnerEl) {
    spinnerEl.style.display = 'flex';
  }
}

function hideLoading() {
  activeRequestsCount--;
  if (activeRequestsCount <= 0) {
    activeRequestsCount = 0;
    const spinnerEl = document.getElementById('globalLoadingSpinner');
    if (spinnerEl) {
      spinnerEl.style.display = 'none';
    }
  }
}

// Helper: Sinisiguro kung expired na ang JWT token sa browser bago pa tumawag sa server
function isJwtExpired(token) {
  if (!token) return true;
  try {
    const payloadBase64 = token.split('.')[1];
    if (!payloadBase64) return false;
    const decodedJson = JSON.parse(atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/')));
    if (!decodedJson.exp) return false;
    const nowInSeconds = Math.floor(Date.now() / 1000);
    return decodedJson.exp < nowInSeconds;
  } catch (e) {
    return false;
  }
}

function forceSessionLogout() {
  localStorage.removeItem('pos_user');
  localStorage.removeItem('pos_token');
  localStorage.removeItem('pos_active_view');
  location.reload();
}

async function apiRequest(url, method = 'GET', bodyData = null) {
  showLoading();
  try {
    const base = typeof CONFIG !== 'undefined' && CONFIG.API_BASE_URL ? CONFIG.API_BASE_URL : 'http://localhost:5000/api';
    const fullUrl = url.startsWith('http') ? url : `${base}${url.startsWith('/') ? '' : '/'}${url}`;

    const token = localStorage.getItem('pos_token');
    const isAuthRoute = url.includes('/auth/login');

    // 1. Kung hindi login route at expired na ang JWT token, i-logout na agad!
    if (!isAuthRoute && token && isJwtExpired(token)) {
      forceSessionLogout();
      throw new Error('Session expired. Please log in again.');
    }

    const headers = {
      'Content-Type': 'application/json'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const config = {
      method: method.toUpperCase(),
      headers: headers
    };

    if (bodyData && (method.toUpperCase() === 'POST' || method.toUpperCase() === 'PUT' || method.toUpperCase() === 'PATCH')) {
      config.body = JSON.stringify(bodyData);
    }

    const response = await fetch(fullUrl, config);
    
    // 2. Kung 401 (Invalid/Expired Token mula sa backend) at hindi login attempt
    if (!isAuthRoute && response.status === 401) {
      forceSessionLogout();
      throw new Error('Session expired. Please log in again.');
    }

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Something went wrong on the server.');
    }
    return data;
  } catch (error) {
    console.error(`API Error [${method} ${url}]:`, error);
    throw error;
  } finally {
    hideLoading();
  }
}
