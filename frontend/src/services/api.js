export const API_BASE_URL =
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5000/api'
    : 'https://auto-parts-pos-bmai.onrender.com/api';

function isJwtExpired(token) {
  if (!token) return true;
  try {
    const payloadBase64 = token.split('.')[1];
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

  // 1. Pre-check: Kung expired na ang token bago pa tumawag sa server
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

  // 2. Kung 401 o 403 (Invalid/Expired token) sa main data routes, auto-logout
  const isRoleRestrictedRoute = url.includes('/users') || url.includes('/suppliers');
  if (!isAuthRoute && !isRoleRestrictedRoute && (response.status === 401 || response.status === 403)) {
    forceSessionLogout();
    throw new Error('Session expired. Please log in again.');
  }

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Something went wrong on the server.');
  }
  return data;
}
