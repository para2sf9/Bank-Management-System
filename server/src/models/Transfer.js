import mongoose from 'mongoose';
const transferSchema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  fromAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true },
  toAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true },
  amountMinor: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
  currency: { type: String, default: 'USD' },
  memo: { type: String, default: 'Between my accounts', maxlength: 120 },
  status: { type: String, enum: ['posted'], default: 'posted' }
}, { timestamps: true });
transferSchema.index({ ownerId: 1, createdAt: -1 });
export default mongoose.model('Transfer', transferSchema);
