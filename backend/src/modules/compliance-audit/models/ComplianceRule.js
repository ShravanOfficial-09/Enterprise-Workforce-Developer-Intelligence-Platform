const mongoose = require('mongoose');

const { Schema } = mongoose;

const ComplianceRuleSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    // Stable key allows consistent rule evaluation across versions.
    key: { type: String, required: true, trim: true },
    version: { type: Number, default: 1 },
    enabled: { type: Boolean, default: true },
    // Rule type is explicit so signals are explainable and auditable.
    ruleType: { type: String, required: true, trim: true },
    scope: {
      // Scope narrows evaluation without coupling to Part 1 data models.
      level: {
        type: String,
        enum: ['organization', 'department', 'team', 'employee'],
        default: 'organization'
      },
      departmentId: { type: Schema.Types.ObjectId },
      teamId: { type: Schema.Types.ObjectId }
    },
    evaluationWindow: {
      // Explicit window to keep the rule deterministic and idempotent.
      value: { type: Number, required: true },
      unit: { type: String, enum: ['day', 'week', 'month'], required: true }
    },
    // Thresholds are stored as data to keep compliance logic rule-based.
    thresholds: { type: Schema.Types.Mixed, default: {} },
    // Filters allow excluding specific assignment types without hard-coding.
    filters: { type: Schema.Types.Mixed, default: {} },
    severity: { type: String, enum: ['low', 'medium', 'high'], default: 'low' },
    description: { type: String, default: '' },
    rationale: { type: String, default: '' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    lastUpdatedBy: { type: Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

ComplianceRuleSchema.index({ organizationId: 1, key: 1, version: 1 }, { unique: true });

module.exports = mongoose.model('ComplianceRule', ComplianceRuleSchema);
