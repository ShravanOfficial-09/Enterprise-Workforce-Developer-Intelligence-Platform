const mongoose = require('mongoose');

const { Schema } = mongoose;

const ComplianceSignalSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    ruleId: { type: Schema.Types.ObjectId, ref: 'ComplianceRule', required: true, index: true },
    // Snapshot of rule identity ensures explainability even if rule changes later.
    ruleKey: { type: String, required: true, trim: true },
    ruleVersion: { type: Number, required: true },
    subject: {
      // Signals are derived, not authoritative decisions.
      type: {
        type: String,
        enum: ['organization', 'department', 'team', 'employee', 'project'],
        required: true
      },
      id: { type: Schema.Types.ObjectId, required: true }
    },
    severity: { type: String, enum: ['low', 'medium', 'high'], required: true },
    status: { type: String, enum: ['active', 'resolved', 'superseded'], default: 'active' },
    computedAt: { type: Date, default: Date.now },
    evaluationWindow: {
      start: { type: Date },
      end: { type: Date }
    },
    // Reference assignments only; do not duplicate Part 1 data.
    assignmentIds: [{ type: Schema.Types.ObjectId, ref: 'Assignment' }],
    metrics: { type: Schema.Types.Mixed, default: {} },
    explanation: { type: String, default: '' },
    // Fingerprint supports idempotent re-evaluation of the same rule window.
    fingerprint: { type: String, required: true, index: true }
  },
  { timestamps: true }
);

ComplianceSignalSchema.index({ organizationId: 1, 'subject.type': 1, 'subject.id': 1, status: 1 });
ComplianceSignalSchema.index({ organizationId: 1, fingerprint: 1 }, { unique: true });

module.exports = mongoose.model('ComplianceSignal', ComplianceSignalSchema);
