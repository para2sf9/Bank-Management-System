import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  eventType: { type: String, required: true, maxlength: 48 },
  entityType: { type: String, default: null, maxlength: 48 },
  entityId: { type: String, default: null, maxlength: 64 },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: { createdAt: true, updatedAt: false } });
schema.index({ actorId: 1, createdAt: -1 });
schema.index({ createdAt: 1 }, { expireAfterSeconds: 15552000 });
export default mongoose.model('AuditEvent', schema);
