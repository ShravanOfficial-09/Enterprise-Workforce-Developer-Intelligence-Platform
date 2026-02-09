const mongoose = require('mongoose');

const { Schema } = mongoose;

const WindowSchema = new Schema(
  {
    value: { type: Number, required: true },
    unit: { type: String, enum: ['day', 'week', 'month'], required: true }
  },
  { _id: false }
);

const ConditionSchema = new Schema(
  {
    // Sources are limited to system signals, not raw activity.
    source: { type: String, enum: ['allocation', 'compliance', 'productivity'], required: true },
    signalKey: { type: String, required: true, trim: true },
    // Minimum count keeps logic explicit and explainable.
    minOccurrences: { type: Number, default: 1 },
    // Optional window allows per-condition time bounds.
    window: { type: WindowSchema }
  },
  { _id: false }
);

const BurnoutRiskRuleSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    key: { type: String, required: true, trim: true },
    version: { type: Number, default: 1 },
    enabled: { type: Boolean, default: true },
    // Scope defines who the rule can target without using personal data.
    scope: {
      type: String,
      enum: ['organization', 'department', 'team', 'employee'],
      default: 'organization'
    },
    // Correlation logic is data-driven for auditability.
    matchPolicy: { type: String, enum: ['all', 'any'], default: 'all' },
    minMatches: { type: Number, default: 1 },
    evaluationWindow: { type: WindowSchema, required: true },
    conditions: { type: [ConditionSchema], default: [] },
    severity: { type: String, enum: ['low', 'medium', 'high'], default: 'low' },
    description: { type: String, default: '' },
    rationale: { type: String, default: '' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    lastUpdatedBy: { type: Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

BurnoutRiskRuleSchema.index({ organizationId: 1, key: 1, version: 1 }, { unique: true });

module.exports = mongoose.model('BurnoutRiskRule', BurnoutRiskRuleSchema);
