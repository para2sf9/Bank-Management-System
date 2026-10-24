import { Router } from 'express';
import mongoose from 'mongoose';
import Account from '../models/Account.js';
import Transfer from '../models/Transfer.js';
import LedgerEntry from '../models/LedgerEntry.js';
import IdempotencyRecord from '../models/IdempotencyRecord.js';
import AuditEvent from '../models/AuditEvent.js';
import { requireAuth } from '../middleware/auth.js';
import { requireCsrf } from '../middleware/csrf.js';
export const transferRouter = Router();
transferRouter.post('/', requireAuth, requireCsrf, async (req, res, next) => {
  const { fromAccountId, toAccountId, amount, memo = 'Between my accounts' } = req.body || {};
  const key = req.get('idempotency-key');
  if (!key || key.length > 100) return res.status(400).json({ error: 'A valid idempotency key is required.' });
  if (!mongoose.isValidObjectId(fromAccountId) || !mongoose.isValidObjectId(toAccountId) || fromAccountId === toAccountId) return res.status(400).json({ error: 'Choose two different accounts.' });
  if (typeof amount !== 'string' || !/^\d{1,8}(?:\.\d{1,2})?$/.test(amount)) return res.status(400).json({ error: 'Enter a valid amount with up to two decimal places.' });
  const amountMinor = Math.round(Number(amount) * 100);
  if (!Number.isSafeInteger(amountMinor) || amountMinor < 1 || amountMinor > 100000000) return res.status(400).json({ error: 'Transfer must be between $0.01 and $1,000,000.' });
  const safeMemo = typeof memo === 'string' ? memo.trim().slice(0, 120) || 'Between my accounts' : 'Between my accounts';
  const session = await mongoose.startSession();
  let transferId;
  try {
    await session.withTransaction(async () => {
      const prior = await IdempotencyRecord.findOne({ ownerId: req.user._id, key }).session(session);
      if (prior) { transferId = prior.transferId; return; }
      const ids = [new mongoose.Types.ObjectId(fromAccountId), new mongoose.Types.ObjectId(toAccountId)];
      const accounts = await Account.find({ _id: { $in: ids }, ownerId: req.user._id, status: 'active' }).session(session);
      const source = accounts.find(a => a._id.toString() === fromAccountId);
      const destination = accounts.find(a => a._id.toString() === toAccountId);
      if (!source || !destination) { const e = new Error('Choose accounts belonging to your profile.'); e.status = 403; throw e; }
      if (source.currency !== destination.currency) { const e = new Error('Accounts must use the same currency.'); e.status = 400; throw e; }
      const debit = await Account.updateOne({ _id: source._id, ownerId: req.user._id, balanceMinor: { $gte: amountMinor }, status: 'active' }, { $inc: { balanceMinor: -amountMinor } }, { session });
      if (debit.modifiedCount !== 1) { const e = new Error('Insufficient funds for this transfer.'); e.status = 400; throw e; }
      const credit = await Account.updateOne({ _id: destination._id, ownerId: req.user._id, status: 'active' }, { $inc: { balanceMinor: amountMinor } }, { session });
      if (credit.modifiedCount !== 1) throw new Error('Could not complete this transfer.');
      const [updatedSource, updatedDestination] = await Promise.all([Account.findById(source._id).session(session), Account.findById(destination._id).session(session)]);
      const [transfer] = await Transfer.create([{ ownerId: req.user._id, fromAccountId: source._id, toAccountId: destination._id, amountMinor, currency: source.currency, memo: safeMemo }], { session });
      transferId = transfer._id;
      await LedgerEntry.create([
        { ownerId: req.user._id, accountId: source._id, transferId, entryType: 'debit', amountMinor, balanceAfterMinor: updatedSource.balanceMinor, description: safeMemo, accountLast4: source.accountLast4, counterpartyLast4: destination.accountLast4 },
        { ownerId: req.user._id, accountId: destination._id, transferId, entryType: 'credit', amountMinor, balanceAfterMinor: updatedDestination.balanceMinor, description: safeMemo, accountLast4: destination.accountLast4, counterpartyLast4: source.accountLast4 }
      ], { session });
      await IdempotencyRecord.create([{ ownerId: req.user._id, key, transferId, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) }], { session });
      await AuditEvent.create([{ actorId: req.user._id, eventType: 'transfer.posted', entityType: 'transfer', entityId: transferId.toString(), metadata: { amountMinor, currency: source.currency } }], { session });
    });
    const transfer = await Transfer.findOne({ _id: transferId, ownerId: req.user._id }).lean();
    res.status(201).json({ transfer: { id: transfer._id, amountMinor: transfer.amountMinor, currency: transfer.currency, memo: transfer.memo, createdAt: transfer.createdAt } });
  } catch (error) {
    if (error.code === 11000) {
      const record = await IdempotencyRecord.findOne({ ownerId: req.user._id, key }).lean();
      if (record) {
        const transfer = await Transfer.findOne({ _id: record.transferId, ownerId: req.user._id }).lean();
        if (transfer) return res.status(200).json({ transfer: { id: transfer._id, amountMinor: transfer.amountMinor, currency: transfer.currency, memo: transfer.memo, createdAt: transfer.createdAt }, replayed: true });
      }
    }
    next(error);
  } finally { await session.endSession(); }
});
