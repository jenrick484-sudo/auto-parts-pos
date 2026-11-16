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

async function apiRequest(url, method = 'GET', bodyData = null) {
  showLoading();
  try {
    // Awtomatikong idikit ang CONFIG.API_BASE_URL mula sa config.js kung relative path ito
    const base = typeof CONFIG !== 'undefined' && CONFIG.API_BASE_URL ? CONFIG.API_BASE_URL : 'http://localhost:5000/api';
    const fullUrl = url.startsWith('http') ? url : `${base}${url.startsWith('/') ? '' : '/'}${url}`;

    const token = localStorage.getItem('pos_token');
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
    
    // Kung unauthorized, i-redirect sa login
    if (response.status === 401) {
      localStorage.removeItem('pos_user');
      localStorage.removeItem('pos_token');
      location.reload();
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