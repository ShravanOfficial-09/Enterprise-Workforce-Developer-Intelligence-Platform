const mongoose = require('mongoose');

const { Schema } = mongoose;

const SubjectSchema = new Schema(
  {
    type: { type: String, enum: ['organization', 'department', 'team', 'employee'], required: true },
    id: { type: Schema.Types.ObjectId, required: true }
  },
  { _id: false }
);

const SourceSignalSchema = new Schema(
  {
    // Reference only derived signals; no raw activity links here.
    source: { type: String, enum: ['allocation', 'compliance', 'productivity'], required: true },
    signalId: { type: Schema.Types.ObjectId, required: true },
    signalKey: { type: String, required: true }
  },
  { _id: false }
);

const BurnoutRiskSignalSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    ruleId: { type: Schema.Types.ObjectId, ref: 'BurnoutRiskRule', required: true, index: true },
    // Snapshotting rule identity preserves explainability over time.
    ruleKey: { type: String, required: true },
    ruleVersion: { type: Number, required: true },
    subject: { type: SubjectSchema, required: true },
    severity: { type: String, enum: ['low', 'medium', 'high'], default: 'low' },
    status: { type: String, enum: ['active', 'resolved', 'superseded'], default: 'active' },
    evaluationWindow: {
      start: { type: Date, required: true },
      end: { type: Date, required: true }
    },
    // Input references keep the signal explainable and reversible.
    sourceSignals: { type: [SourceSignalSchema], default: [] },
    context: { type: Schema.Types.Mixed, default: {} },
    explanation: { type: String, default: '' },
    computedAt: { type: Date, default: Date.now },
    // Fingerprint enables deterministic re-computation without duplicates.
    fingerprint: { type: String, required: true, index: true }
  },
  { timestamps: true }
);

BurnoutRiskSignalSchema.index({ organizationId: 1, 'subject.type': 1, 'subject.id': 1, status: 1 });
BurnoutRiskSignalSchema.index({ organizationId: 1, fingerprint: 1 }, { unique: true });

module.exports = mongoose.model('BurnoutRiskSignal', BurnoutRiskSignalSchema);
