import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  key: { type: String, required: true, maxlength: 100 },
  transferId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transfer', required: true },
  expiresAt: { type: Date, required: true, expires: 0 }
}, { timestamps: true });
schema.index({ ownerId: 1, key: 1 }, { unique: true });
export default mongoose.model('IdempotencyRecord', schema);
