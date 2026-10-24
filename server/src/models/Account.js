import mongoose from 'mongoose';
const accountSchema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  label: { type: String, required: true, maxlength: 40 },
  type: { type: String, enum: ['checking', 'savings'], required: true },
  currency: { type: String, default: 'USD', immutable: true },
  balanceMinor: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
  accountLast4: { type: String, required: true, match: /^\d{4}$/ },
  status: { type: String, enum: ['active', 'frozen'], default: 'active' }
}, { timestamps: true });
accountSchema.index({ ownerId: 1, type: 1 });
export default mongoose.model('Account', accountSchema);
