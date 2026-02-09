const mongoose = require('mongoose');

const SkillSchema = new mongoose.Schema(
  {
    // String keys keep the taxonomy org-defined instead of hard-coded.
    skillKey: { type: String, required: true, trim: true },
    // Proficiency scales vary by org; enforce presence but not bounds.
    proficiency: { type: Number, required: true },
    proficiencyScale: { type: String, default: 'org-default' },
    lastVerifiedAt: { type: Date }
  },
  { _id: false }
);

const CapacitySchema = new mongoose.Schema(
  {
    // Capacity is a conceptual unit, not a proxy for hours worked.
    limit: { type: Number, required: true },
    allocated: { type: Number, default: 0 },
    unit: { type: String, default: 'capacity-unit' }
  },
  { _id: false }
);

const EmployeeSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    fullName: { type: String, required: true, trim: true },
    role: { type: String, required: true, trim: true },
    department: { type: String, required: true, trim: true },
    availabilityStatus: {
      type: String,
      enum: ['available', 'partially_available', 'unavailable'],
      default: 'available'
    },
    capacity: { type: CapacitySchema, required: true },
    skills: { type: [SkillSchema], default: [] },
    // Explicit opt-in for allocation; avoids implicit eligibility.
    isAllocatable: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Employee', EmployeeSchema);
