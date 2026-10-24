import { Router } from 'express';
import mongoose from 'mongoose';
import Account from '../models/Account.js';
import LedgerEntry from '../models/LedgerEntry.js';
import { requireAuth } from '../middleware/auth.js';
export const dataRouter = Router();
dataRouter.use(requireAuth);
dataRouter.get('/dashboard', async (req, res, next) => {
  try {
    const accounts = await Account.find({ ownerId: req.user._id, status: 'active' }).sort({ createdAt: 1 }).lean();
    const accountIds = accounts.map(a => a._id);
    const [recentTransactions, monthly] = await Promise.all([
      LedgerEntry.find({ ownerId: req.user._id, accountId: { $in: accountIds } }).sort({ createdAt: -1, _id: -1 }).limit(8).lean(),
      LedgerEntry.aggregate([
        { $match: { ownerId: req.user._id, accountId: { $in: accountIds }, createdAt: { $gte: new Date(Date.now() - 180 * 86400000) }, entryType: { $in: ['credit', 'debit'] } } },
        { $group: { _id: { month: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, kind: '$entryType' }, totalMinor: { $sum: '$amountMinor' } } },
        { $sort: { '_id.month': 1 } }
      ])
    ]);
    const accountMap = new Map(accounts.map(a => [a._id.toString(), a.label]));
    res.json({
      accounts: accounts.map(a => ({ id: a._id, label: a.label, type: a.type, currency: a.currency, balanceMinor: a.balanceMinor, accountLast4: a.accountLast4 })),
      totalBalanceMinor: accounts.reduce((sum, a) => sum + a.balanceMinor, 0),
      recentTransactions: recentTransactions.map(t => ({ id: t._id, type: t.entryType, amountMinor: t.amountMinor, description: t.description, createdAt: t.createdAt, accountLast4: t.accountLast4, accountLabel: accountMap.get(t.accountId.toString()), counterpartyLast4: t.counterpartyLast4 })),
      monthly: monthly.map(m => ({ month: m._id.month, type: m._id.kind, totalMinor: m.totalMinor }))
    });
  } catch (error) { next(error); }
});
dataRouter.get('/transactions', async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 20, 1), 50);
    const filter = { ownerId: req.user._id };
    if (req.query.accountId) {
      if (!mongoose.isValidObjectId(req.query.accountId)) return res.status(400).json({ error: 'Invalid account filter.' });
      const owned = await Account.exists({ _id: req.query.accountId, ownerId: req.user._id });
      if (!owned) return res.status(404).json({ error: 'Account not found.' });
      filter.accountId = new mongoose.Types.ObjectId(req.query.accountId);
    }
    if (req.query.cursor) {
      try {
        const decoded = Buffer.from(String(req.query.cursor), 'base64url').toString();
        const [iso, id] = decoded.split('|');
        const date = new Date(iso);
        if (!Number.isFinite(date.getTime()) || !mongoose.isValidObjectId(id)) throw new Error();
        filter.$or = [{ createdAt: { $lt: date } }, { createdAt: date, _id: { $lt: new mongoose.Types.ObjectId(id) } }];
      } catch { return res.status(400).json({ error: 'Invalid page cursor.' }); }
    }
    const rows = await LedgerEntry.find(filter).sort({ createdAt: -1, _id: -1 }).limit(limit + 1).lean();
    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit);
    const nextCursor = hasMore && items.length ? Buffer.from(`${items.at(-1).createdAt.toISOString()}|${items.at(-1)._id}`).toString('base64url') : null;
    res.json({ items, nextCursor });
  } catch (error) { next(error); }
});
