const mongoose = require('mongoose');
const employeeRepository = require('../repositories/employeeRepository');
const projectRepository = require('../repositories/projectRepository');
const assignmentRepository = require('../repositories/assignmentRepository');

// Assumptions:
// - Employee and Project documents include organizationId.
// - Employee includes isAllocatable (boolean).
// - Assignment schema includes organizationId and isOverride to persist those fields.
// - organizationId, employeeId, projectId, and decidedBy are ObjectId strings.

const ALLOWED_AVAILABILITY = new Set(['available', 'partially_available']);
const CAPACITY_AFFECTING_STATUSES = new Set(['confirmed', 'overridden']);

const createServiceError = (message, code) => {
  const err = new Error(message);
  err.code = code;
  return err;
};

const ensure = (condition, message, code) => {
  if (!condition) {
    throw createServiceError(message, code);
  }
};

const ensureObjectId = (value, fieldName) => {
  ensure(value, `${fieldName} is required`, 'ASSIGNMENT_INPUT_INVALID');
  ensure(mongoose.Types.ObjectId.isValid(value), `${fieldName} must be a valid ObjectId`, 'ASSIGNMENT_INPUT_INVALID');
  return value.toString();
};

const sumAllocatedUnits = (assignments) => assignments.reduce((total, assignment) => {
  if (!CAPACITY_AFFECTING_STATUSES.has(assignment.status)) {
    return total;
  }
  const units = assignment.allocation && Number.isFinite(assignment.allocation.units)
    ? assignment.allocation.units
    : 0;
  return total + units;
}, 0);

const resolveAllocationUnits = (inputUnits, project) => {
  if (Number.isFinite(inputUnits)) {
    return inputUnits;
  }

  const projectUnits = project.expectedWorkload && Number.isFinite(project.expectedWorkload.units)
    ? project.expectedWorkload.units
    : null;

  ensure(projectUnits !== null, 'Allocation units are required', 'ASSIGNMENT_INPUT_INVALID');
  return projectUnits;
};

const confirmAssignment = async (input) => {
  ensure(input && typeof input === 'object', 'Input payload is required', 'ASSIGNMENT_INPUT_INVALID');

  const employeeId = ensureObjectId(input.employeeId, 'employeeId');
  const projectId = ensureObjectId(input.projectId, 'projectId');
  const organizationId = ensureObjectId(input.organizationId, 'organizationId');
  const decidedBy = ensureObjectId(input.decidedBy, 'decidedBy');
  const justification = typeof input.justification === 'string' ? input.justification : '';
  const isOverride = Boolean(input.isOverride);

  const [employee, project] = await Promise.all([
    employeeRepository.getById(employeeId),
    projectRepository.getById(projectId)
  ]);

  ensure(employee, 'Employee not found', 'EMPLOYEE_NOT_FOUND');
  ensure(project, 'Project not found', 'PROJECT_NOT_FOUND');

  const employeeOrgId = employee.organizationId ? employee.organizationId.toString() : null;
  const projectOrgId = project.organizationId ? project.organizationId.toString() : null;

  ensure(employeeOrgId, 'Employee organizationId is missing', 'EMPLOYEE_ORG_MISSING');
  ensure(projectOrgId, 'Project organizationId is missing', 'PROJECT_ORG_MISSING');
  ensure(employeeOrgId === organizationId, 'Employee does not belong to this organization', 'EMPLOYEE_ORG_MISMATCH');
  ensure(projectOrgId === organizationId, 'Project does not belong to this organization', 'PROJECT_ORG_MISMATCH');

  // Explicitly require allocatability to avoid silent auto-assignments.
  ensure(employee.isAllocatable === true, 'Employee is not allocatable', 'EMPLOYEE_NOT_ALLOCATABLE');
  ensure(ALLOWED_AVAILABILITY.has(employee.availabilityStatus), 'Employee is not currently available', 'EMPLOYEE_NOT_AVAILABLE');

  const capacityLimit = employee.capacity && Number.isFinite(employee.capacity.limit)
    ? employee.capacity.limit
    : null;

  ensure(capacityLimit !== null, 'Employee capacity limit is missing', 'EMPLOYEE_CAPACITY_INVALID');

  const existingAssignments = await assignmentRepository.listByEmployee(employeeId);
  const allocatedUnits = sumAllocatedUnits(existingAssignments);
  const remainingCapacity = capacityLimit - allocatedUnits;

  const allocationUnits = resolveAllocationUnits(input.allocationUnits, project);
  ensure(allocationUnits > 0, 'Allocation units must be greater than zero', 'ASSIGNMENT_INPUT_INVALID');
  ensure(remainingCapacity >= allocationUnits, 'Employee does not have sufficient remaining capacity', 'EMPLOYEE_CAPACITY_INSUFFICIENT');

  const now = new Date();

  const assignmentPayload = {
    employeeId,
    projectId,
    organizationId,
    status: isOverride ? 'overridden' : 'confirmed',
    source: isOverride ? 'manual' : 'suggestion',
    isOverride,
    allocation: {
      units: allocationUnits,
      unit: project.expectedWorkload && project.expectedWorkload.unit ? project.expectedWorkload.unit : 'capacity-unit'
    },
    decision: {
      decidedBy,
      decidedAt: now,
      reason: justification
    },
    history: [
      {
        action: isOverride ? 'overridden' : 'confirmed',
        actorId: decidedBy,
        at: now,
        fromStatus: 'proposed',
        toStatus: isOverride ? 'overridden' : 'confirmed',
        note: justification
      }
    ]
  };

  return assignmentRepository.create(assignmentPayload);
};

module.exports = { confirmAssignment };
