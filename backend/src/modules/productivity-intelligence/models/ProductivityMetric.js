const mongoose = require('mongoose');

const { Schema } = mongoose;

const SubjectSchema = new Schema(
  {
    // Prefer team/org-level insights; developer is supported only for self-trends.
    type: { type: String, enum: ['organization', 'team', 'developer', 'repository'], required: true },
    id: { type: Schema.Types.ObjectId, required: true }
  },
  { _id: false }
);

const WindowSchema = new Schema(
  {
    value: { type: Number, required: true },
    unit: { type: String, enum: ['day', 'week', 'month'], required: true }
  },
  { _id: false }
);

const ProductivityMetricSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    metricKey: { type: String, required: true, trim: true },
    metricVersion: { type: Number, default: 1 },
    subject: { type: SubjectSchema, required: true },
    // Window defines the time slice used for deterministic recomputation.
    window: { type: WindowSchema, required: true },
    period: {
      start: { type: Date, required: true },
      end: { type: Date, required: true }
    },
    // Value is a derived trend datapoint, not a score or ranking.
    value: { type: Number, required: true },
    unit: { type: String, default: 'count' },
    // Inputs describe how the metric was computed for explainability.
    inputs: { type: Schema.Types.Mixed, default: {} },
    computedAt: { type: Date, default: Date.now },
    // Fingerprint enables idempotent re-evaluation of the same window.
    fingerprint: { type: String, required: true, index: true }
  },
  { timestamps: true }
);

ProductivityMetricSchema.index({ organizationId: 1, metricKey: 1, 'subject.type': 1, 'subject.id': 1, 'period.start': 1 });
ProductivityMetricSchema.index({ organizationId: 1, fingerprint: 1 }, { unique: true });

module.exports = mongoose.model('ProductivityMetric', ProductivityMetricSchema);
