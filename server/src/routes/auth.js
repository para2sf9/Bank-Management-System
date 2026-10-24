import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Account from '../models/Account.js';
import AuditEvent from '../models/AuditEvent.js';
import { requireAuth } from '../middleware/auth.js';
import { issueCsrf, requireCsrf, clearCsrf } from '../middleware/csrf.js';
export const authRouter = Router();
const authLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 12, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Too many attempts. Please wait a few minutes.' } });
const sessionCookie = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/', maxAge: 2 * 60 * 60 * 1000 };
function setSession(res, user) { res.cookie('session', jwt.sign({ sub: user._id.toString() }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '2h' }), sessionCookie); }
function validEmail(email) { return typeof email === 'string' && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }
authRouter.get('/csrf', issueCsrf);
authRouter.get('/me', requireAuth, (req, res) => res.json({ user: { id: req.user.id, name: req.user.name, email: req.user.email } }));
authRouter.post('/register', authLimit, requireCsrf, async (req, res, next) => {
  try {
    const { name, email, password } = req.body || {};
    if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 80 || !validEmail(email) || typeof password !== 'string' || password.length < 10 || password.length > 72) return res.status(400).json({ error: 'Enter a name, valid email, and password of 10–72 characters.' });
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) return res.status(400).json({ error: 'Use at least one uppercase letter, one lowercase letter, and one number.' });
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ name: name.trim(), email: email.trim().toLowerCase(), passwordHash });
    const suffix = Math.floor(1000 + Math.random() * 9000).toString();
    await Account.create({ ownerId: user._id, label: 'Everyday checking', type: 'checking', balanceMinor: 0, accountLast4: suffix });
    await AuditEvent.create({ actorId: user._id, eventType: 'account.registered', entityType: 'user' });
    setSession(res, user);
    res.status(201).json({ user: { id: user.id, name: user.name, email: user.email } });
  } catch (error) { next(error); }
});
authRouter.post('/login', authLimit, requireCsrf, async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!validEmail(email) || typeof password !== 'string') return res.status(400).json({ error: 'Enter your email and password.' });
    const user = await User.findOne({ email: email.trim().toLowerCase(), status: 'active' }).select('+passwordHash name email');
    const matches = user ? await bcrypt.compare(password, user.passwordHash) : false;
    if (!matches) return res.status(401).json({ error: 'Email or password is incorrect.' });
    await AuditEvent.create({ actorId: user._id, eventType: 'session.signed_in', entityType: 'user' });
    setSession(res, user);
    res.json({ user: { id: user.id, name: user.name, email: user.email } });
  } catch (error) { next(error); }
});
authRouter.post('/logout', requireCsrf, (req, res) => {
  res.clearCookie('session', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/' });
  clearCsrf(res);
  res.json({ ok: true });
});
