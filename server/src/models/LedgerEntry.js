import mongoose from 'mongoose';
const ledgerSchema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true },
  transferId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transfer', default: null },
  entryType: { type: String, enum: ['opening', 'credit', 'debit'], required: true },
  amountMinor: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
  balanceAfterMinor: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
  description: { type: String, required: true, maxlength: 120 },
  accountLast4: { type: String, required: true, match: /^\d{4}$/ },
  counterpartyLast4: { type: String, default: null }
}, { timestamps: { createdAt: true, updatedAt: false } });
ledgerSchema.index({ ownerId: 1, createdAt: -1, _id: -1 });
ledgerSchema.index({ accountId: 1, createdAt: -1 });
ledgerSchema.index({ transferId: 1 });
// Ledger rows are append-only by application convention; there are intentionally no edit/delete API routes.
export default mongoose.model('LedgerEntry', ledgerSchema);
