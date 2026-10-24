import jwt from 'jsonwebtoken';
import User from '../models/User.js';
export async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.session;
    if (!token) return res.status(401).json({ error: 'Please sign in to continue.' });
    const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    const user = await User.findOne({ _id: payload.sub, status: 'active' }).select('_id name email');
    if (!user) return res.status(401).json({ error: 'Your session is no longer valid.' });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Please sign in again.' });
  }
}
