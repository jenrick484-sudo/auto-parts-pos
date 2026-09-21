// HELPER FUNCTIONS FOR LOADING SPINNER
function showLoading(message = 'Please wait, loading...') {
  const spinner = document.getElementById('globalLoadingSpinner');
  const textEl = document.getElementById('loadingText');
  if (textEl) textEl.textContent = message;
  if (spinner) spinner.style.display = 'flex';
}

function hideLoading() {
  const spinner = document.getElementById('globalLoadingSpinner');
  if (spinner) spinner.style.display = 'none';
}

async function apiRequest(endpoint, method = 'GET', body = null, customLoadingMsg = null) {
  showLoading(customLoadingMsg || 'Please wait, loading...');
  const token = localStorage.getItem('pos_token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);

  try {
    const response = await fetch(`${CONFIG.API_BASE_URL}${endpoint}`, options);
    const data = await response.json();
    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem('pos_token');
        localStorage.removeItem('pos_user');
        document.getElementById('loginScreen').style.display = 'flex';
      }
      throw new Error(data.message || 'An API error occurred.');
    }
    return data;
  } catch (err) {
    console.error('API Error:', err.message);
    throw err;
  } finally {
    hideLoading();
  }
}
