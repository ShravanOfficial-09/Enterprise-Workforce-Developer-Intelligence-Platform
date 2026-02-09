const mongoose = require('mongoose');

const { Schema } = mongoose;

const DeveloperActivitySchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    // Developer identity is for attribution, not surveillance.
    developerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // Explicit event types keep the data bounded to Git-derived activity.
    eventType: {
      type: String,
      enum: ['commit', 'pr_opened', 'pr_merged', 'pr_reviewed', 'pr_comment'],
      required: true
    },
    // eventAt reflects when the Git event occurred (not when ingested).
    eventAt: { type: Date, required: true, index: true },
    // eventKey supports idempotent ingestion without storing raw payloads.
    eventKey: { type: String, required: true },
    repository: {
      // Minimal repository snapshot keeps context without storing code content.
      id: { type: String },
      name: { type: String },
      provider: { type: String }
    },
    // Metadata is limited to non-invasive, explainable context.
    metadata: { type: Schema.Types.Mixed, default: {} },
    ingestedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

DeveloperActivitySchema.index({ organizationId: 1, eventKey: 1 }, { unique: true });
DeveloperActivitySchema.index({ organizationId: 1, developerId: 1, eventAt: -1 });

module.exports = mongoose.model('DeveloperActivity', DeveloperActivitySchema);
