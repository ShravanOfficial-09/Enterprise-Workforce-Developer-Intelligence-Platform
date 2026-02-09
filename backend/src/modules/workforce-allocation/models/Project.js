const mongoose = require('mongoose');

const RequiredSkillSchema = new mongoose.Schema(
  {
    skillKey: { type: String, required: true, trim: true },
    minProficiency: { type: Number, required: true },
    proficiencyScale: { type: String, default: 'org-default' }
  },
  { _id: false }
);

const WorkloadSchema = new mongoose.Schema(
  {
    units: { type: Number, required: true },
    unit: { type: String, default: 'capacity-unit' }
  },
  { _id: false }
);

const TimelineSchema = new mongoose.Schema(
  {
    startDate: { type: Date, required: true },
    endDate: { type: Date }
  },
  { _id: false }
);

const ProjectSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    // Requirements stay with the project to keep suggestions deterministic.
    requiredSkills: { type: [RequiredSkillSchema], default: [] },
    expectedWorkload: { type: WorkloadSchema, required: true },
    timeline: { type: TimelineSchema, required: true },
    assignmentStatus: {
      type: String,
      enum: ['unassigned', 'partially_assigned', 'assigned', 'completed'],
      default: 'unassigned'
    },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Project', ProjectSchema);
