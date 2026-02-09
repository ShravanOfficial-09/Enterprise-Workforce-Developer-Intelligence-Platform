const mongoose = require('mongoose');

const AssignmentSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    status: {
      type: String,
      enum: ['proposed', 'confirmed', 'overridden', 'rejected'],
      default: 'proposed'
    },
    // Source preserves human accountability without implying automation.
    source: { type: String, enum: ['suggestion', 'manual'], required: true },
    isOverride: { type: Boolean, default: false },
    allocation: {
      units: { type: Number, required: true },
      unit: { type: String, default: 'capacity-unit' }
    },
    decision: {
      decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      decidedAt: { type: Date },
      reason: { type: String, default: '' }
    },
    // History is retained for auditability and later review.
    history: [
      {
        action: { type: String, required: true },
        actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        at: { type: Date, default: Date.now },
        fromStatus: { type: String },
        toStatus: { type: String },
        note: { type: String, default: '' }
      }
    ]
  },
  { timestamps: true }
);

AssignmentSchema.index({ employeeId: 1, projectId: 1, status: 1 });

module.exports = mongoose.model('Assignment', AssignmentSchema);
