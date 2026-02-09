const mongoose = require('mongoose');

const { Schema } = mongoose;

const SubjectSchema = new Schema(
  {
    type: { type: String, enum: ['organization', 'team', 'developer', 'repository'], required: true },
    id: { type: Schema.Types.ObjectId, required: true }
  },
  { _id: false }
);

const ProductivitySignalSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    // Signals are derived insights, not authoritative judgments.
    signalKey: { type: String, required: true, trim: true },
    signalVersion: { type: Number, default: 1 },
    subject: { type: SubjectSchema, required: true },
    severity: { type: String, enum: ['low', 'medium', 'high'], default: 'low' },
    status: { type: String, enum: ['active', 'resolved', 'superseded'], default: 'active' },
    evaluationWindow: {
      start: { type: Date, required: true },
      end: { type: Date, required: true }
    },
    // References keep the signal explainable without duplicating source data.
    metricIds: [{ type: Schema.Types.ObjectId, ref: 'ProductivityMetric' }],
    activityIds: [{ type: Schema.Types.ObjectId, ref: 'DeveloperActivity' }],
    context: { type: Schema.Types.Mixed, default: {} },
    explanation: { type: String, default: '' },
    computedAt: { type: Date, default: Date.now },
    fingerprint: { type: String, required: true, index: true }
  },
  { timestamps: true }
);

ProductivitySignalSchema.index({ organizationId: 1, 'subject.type': 1, 'subject.id': 1, status: 1 });
ProductivitySignalSchema.index({ organizationId: 1, fingerprint: 1 }, { unique: true });

module.exports = mongoose.model('ProductivitySignal', ProductivitySignalSchema);
