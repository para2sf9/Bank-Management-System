import crypto from 'node:crypto';
const cookieOptions = () => ({ httpOnly: false, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/', maxAge: 2 * 60 * 60 * 1000 });
function signature(value) { return crypto.createHmac('sha256', process.env.JWT_SECRET).update(value).digest('base64url'); }
export function issueCsrf(req, res) {
  const nonce = crypto.randomBytes(24).toString('base64url');
  const token = `${nonce}.${signature(nonce)}`;
  res.cookie('csrf', token, cookieOptions());
  res.json({ ok: true });
}
export function requireCsrf(req, res, next) {
  const cookie = req.cookies?.csrf;
  const header = req.get('x-csrf-token');
  if (!cookie || !header || cookie !== header) return res.status(403).json({ error: 'Security token missing. Refresh and try again.' });
  const [nonce, sig, extra] = cookie.split('.');
  if (!nonce || !sig || extra || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(signature(nonce)))) {
    return res.status(403).json({ error: 'Security token invalid. Refresh and try again.' });
  }
  next();
}
export function clearCsrf(res) { res.clearCookie('csrf', { path: '/', sameSite: 'strict', secure: process.env.NODE_ENV === 'production' }); }
