const mongoose = require('mongoose');

const { Schema } = mongoose;

const AuditLogSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true, immutable: true },
    actorId: { type: Schema.Types.ObjectId, ref: 'User', immutable: true },
    eventType: { type: String, required: true, immutable: true },
    ruleId: { type: Schema.Types.ObjectId, ref: 'ComplianceRule', immutable: true },
    signalId: { type: Schema.Types.ObjectId, ref: 'ComplianceSignal', immutable: true },
    // Immutable snapshot for auditability; avoid copying full Part 1 data.
    context: { type: Schema.Types.Mixed, default: {}, immutable: true },
    occurredAt: { type: Date, default: Date.now, immutable: true },
    correlationId: { type: String, index: true, immutable: true }
  },
  {
    // Append-only by design; no updatedAt to discourage edits.
    timestamps: { createdAt: true, updatedAt: false }
  }
);

AuditLogSchema.index({ organizationId: 1, occurredAt: -1 });

module.exports = mongoose.model('AuditLog', AuditLogSchema);
