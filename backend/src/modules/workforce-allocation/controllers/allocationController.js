const allocationService = require('../services/allocationService');
const assignmentService = require('../services/assignmentService');
const assignmentRepository = require('../repositories/assignmentRepository');
const projectRepository = require('../repositories/projectRepository');

const ERROR_STATUS_MAP = {
  ASSIGNMENT_INPUT_INVALID: 400,
  EMPLOYEE_NOT_FOUND: 404,
  PROJECT_NOT_FOUND: 404,
  EMPLOYEE_ORG_MISSING: 409,
  PROJECT_ORG_MISSING: 409,
  EMPLOYEE_ORG_MISMATCH: 403,
  PROJECT_ORG_MISMATCH: 403,
  EMPLOYEE_NOT_ALLOCATABLE: 409,
  EMPLOYEE_NOT_AVAILABLE: 409,
  EMPLOYEE_CAPACITY_INVALID: 409,
  EMPLOYEE_CAPACITY_INSUFFICIENT: 409
};

const resolveOrganizationId = (user) => user?.organizationId || user?.orgId || null;
const resolveDecidedBy = (user) => user?._id || user?.id || null;

const handleServiceError = (err, res, next) => {
  if (!err || !err.code || !ERROR_STATUS_MAP[err.code]) {
    return next(err);
  }

  return res.status(ERROR_STATUS_MAP[err.code]).json({ message: err.message, code: err.code });
};

exports.getSuggestions = async (req, res, next) => {
  try {
    const { projectId } = req.query;
    if (!projectId) {
      return res.status(400).json({ message: 'projectId is required' });
    }

    const project = await projectRepository.getById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const suggestions = await allocationService.getSuggestionsForProject(project);
    return res.json({ data: suggestions });
  } catch (err) {
    return next(err);
  }
};

exports.confirmAssignment = async (req, res, next) => {
  try {
    const organizationId = resolveOrganizationId(req.user);
    const decidedBy = resolveDecidedBy(req.user);

    if (!organizationId) {
      return res.status(400).json({ message: 'organizationId is required' });
    }

    if (!decidedBy) {
      return res.status(400).json({ message: 'decidedBy is required' });
    }

    const { employeeId, projectId, allocationUnits } = req.body;
    const justification = typeof req.body.justification === 'string'
      ? req.body.justification
      : (req.body.reason || '');

    const assignment = await assignmentService.confirmAssignment({
      employeeId,
      projectId,
      allocationUnits,
      organizationId,
      decidedBy,
      justification,
      isOverride: false
    });

    return res.status(201).json({ data: assignment });
  } catch (err) {
    return handleServiceError(err, res, next);
  }
};

exports.overrideAssignment = async (req, res, next) => {
  try {
    const { assignmentId } = req.params;
    const organizationId = resolveOrganizationId(req.user);
    const decidedBy = resolveDecidedBy(req.user);

    if (!organizationId) {
      return res.status(400).json({ message: 'organizationId is required' });
    }

    if (!decidedBy) {
      return res.status(400).json({ message: 'decidedBy is required' });
    }

    let { employeeId, projectId, allocationUnits } = req.body;
    let originalAssignment = null;

    if (assignmentId && (!employeeId || !projectId || !Number.isFinite(allocationUnits))) {
      originalAssignment = await assignmentRepository.getById(assignmentId);

      if (!originalAssignment) {
        return res.status(404).json({ message: 'Assignment not found' });
      }

      if (!employeeId) {
        employeeId = originalAssignment.employeeId?.toString();
      }

      if (!projectId) {
        projectId = originalAssignment.projectId?.toString();
      }

      if (!Number.isFinite(allocationUnits)) {
        allocationUnits = originalAssignment.allocation?.units;
      }
    }

    const justification = typeof req.body.justification === 'string'
      ? req.body.justification
      : (req.body.reason || '');

    const assignment = await assignmentService.confirmAssignment({
      employeeId,
      projectId,
      allocationUnits,
      organizationId,
      decidedBy,
      justification,
      isOverride: true
    });

    if (originalAssignment && originalAssignment.status !== 'rejected') {
      const now = new Date();
      await assignmentRepository.updateById(originalAssignment._id, {
        $set: {
          status: 'rejected',
          decision: { decidedBy, decidedAt: now, reason: justification }
        },
        $push: {
          history: {
            action: 'rejected',
            actorId: decidedBy,
            at: now,
            fromStatus: originalAssignment.status,
            toStatus: 'rejected',
            note: 'Superseded by override'
          }
        }
      });
    }

    return res.status(201).json({ data: assignment });
  } catch (err) {
    return handleServiceError(err, res, next);
  }
};
