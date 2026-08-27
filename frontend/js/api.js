async function apiRequest(endpoint, method = 'GET', body = null) {
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
      if (response.status === 401 || response.status === 403) {
        // Automatic logout kapag expired na ang JWT session
        localStorage.removeItem('pos_token');
        localStorage.removeItem('pos_user');
        document.getElementById('loginScreen').style.display = 'flex';
      }
      throw new Error(data.message || 'May naganap na error sa API.');
    }

    return data;
  } catch (err) {
    console.error('API Error:', err.message);
    throw err;
  }
}