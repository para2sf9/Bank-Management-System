const API = import.meta.env.VITE_API_URL || '/api';
function csrfCookie() {
  const value = document.cookie.split(';').map(part => part.trim()).find(part => part.startsWith('csrf='))
    ?.slice('csrf='.length);
  if (!value) return '';
  try { return decodeURIComponent(value); } catch { return value; }
}
async function refreshCsrf() {
  const response = await fetch(`${API}/auth/csrf`, { credentials: 'include' });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || 'Could not refresh the security token. Please try again.');
  }
}
export async function api(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const mutating = !['GET', 'HEAD', 'OPTIONS'].includes(method);
  if (mutating && !csrfCookie()) await refreshCsrf();
  const send = () => {
    const headers = { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) };
    if (mutating) headers['X-CSRF-Token'] = csrfCookie();
    return fetch(`${API}${path}`, { ...options, method, headers, credentials: 'include' });
  };
  let response = await send();
  const payload = await response.json().catch(() => ({}));
  if (mutating && response.status === 403 && /security token (missing|invalid)/i.test(payload.error || '')) {
    await refreshCsrf();
    response = await send();
    const retryPayload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(retryPayload.error || 'Something went wrong.');
    return retryPayload;
  }
  if (!response.ok) throw new Error(payload.error || 'Something went wrong.');
  return payload;
}
export const money = (minor, currency = 'USD') => new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 2 }).format((minor || 0) / 100);
