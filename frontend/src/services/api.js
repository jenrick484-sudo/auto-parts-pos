export const API_BASE_URL =
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5000/api'
    : 'https://auto-parts-pos-bmai.onrender.com/api';

function isJwtExpired(token) {
  if (!token) return true;
  try {
    const payloadBase64 = token.split('.');
    if (!payloadBase64) return false;
    const decodedJson = JSON.parse(atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/')));
    if (!decodedJson.exp) return false;
    return decodedJson.exp < Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export function forceSessionLogout() {
  localStorage.removeItem('pos_user');
  localStorage.removeItem('pos_token');
  window.location.reload();
}

export async function apiRequest(url, method = 'GET', bodyData = null) {
  const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
  const token = localStorage.getItem('pos_token');
  const isAuthRoute = url.includes('/auth/login');

  if (!isAuthRoute && token && isJwtExpired(token)) {
    forceSessionLogout();
    throw new Error('Session expired. Please log in again.');
  }

  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config = { method: method.toUpperCase(), headers };
  if (bodyData && ['POST', 'PUT', 'PATCH'].includes(config.method)) {
    config.body = JSON.stringify(bodyData);
  }

  const response = await fetch(fullUrl, config);

  if (!isAuthRoute && response.status === 401) {
    forceSessionLogout();
    throw new Error('Session expired. Please log in again.');
  }

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Something went wrong on the server.');
  }
  return data;
}
