const crypto = require('crypto');
const mongoose = require('mongoose');

const ComplianceRule = require('../models/ComplianceRule');
const ComplianceSignal = require('../models/ComplianceSignal');
const auditLogService = require('./auditLogService');

// Read-only dependency on Part 1; Assignments remain the source of truth.
const Assignment = require('../../workforce-allocation/models/Assignment');

// Assumptions:
// - Assignment documents include organizationId (for org-level filtering).
// - Assignment timestamps (createdAt) represent when the decision was recorded.
// - ComplianceRule.thresholds for this rule include maxAssignments (number).

const RULE_TYPE_MAX_ASSIGNMENTS = 'MAX_ASSIGNMENTS_PER_EMPLOYEE';
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

const normalizeObjectId = (value, fieldName, required = true) => {
  if (!value && !required) {
    return null;
  }

  ensure(value, `${fieldName} is required`, 'COMPLIANCE_INPUT_INVALID');
  ensure(mongoose.Types.ObjectId.isValid(value), `${fieldName} must be a valid ObjectId`, 'COMPLIANCE_INPUT_INVALID');
  return value.toString();
};

const computeWindow = (evaluationWindow, asOf) => {
  ensure(evaluationWindow && typeof evaluationWindow === 'object', 'evaluationWindow is required', 'COMPLIANCE_RULE_INVALID');
  const value = Number(evaluationWindow.value);
  const unit = evaluationWindow.unit;

  ensure(Number.isFinite(value) && value > 0, 'evaluationWindow.value must be greater than zero', 'COMPLIANCE_RULE_INVALID');
  ensure(['day', 'week', 'month'].includes(unit), 'evaluationWindow.unit is invalid', 'COMPLIANCE_RULE_INVALID');

  const end = new Date(asOf);
  const start = new Date(asOf);

  if (unit === 'month') {
    start.setMonth(start.getMonth() - value);
  } else {
    const days = unit === 'week' ? value * 7 : value;
    start.setTime(start.getTime() - (days * 24 * 60 * 60 * 1000));
  }

  return { start, end };
};

const buildFingerprint = ({ organizationId, ruleId, ruleVersion, subjectType, subjectId, windowStart, windowEnd }) => {
  const payload = [
    organizationId,
    ruleId,
    ruleVersion,
    subjectType,
    subjectId,
    windowStart.toISOString(),
    windowEnd.toISOString()
  ].join('|');

  return crypto.createHash('sha256').update(payload).digest('hex');
};

const logEvaluation = async ({ organizationId, actorId, ruleId, signalId, context }) => {
  // AuditLog is append-only; every evaluation leaves a trace for review.
  await auditLogService.logRuleEvaluation({
    organizationId,
    actorId: actorId || undefined,
    ruleId,
    signalId,
    context,
    occurredAt: new Date(),
    correlationId: context?.correlationId
  });
};

const evaluateMaxAssignmentsRule = async ({ organizationId, rule, asOf }) => {
  const { start, end } = computeWindow(rule.evaluationWindow, asOf);
  const maxAssignments = Number(rule.thresholds?.maxAssignments);

  ensure(Number.isFinite(maxAssignments) && maxAssignments > 0, 'thresholds.maxAssignments must be a positive number', 'COMPLIANCE_RULE_INVALID');

  const assignments = await Assignment.find({
    organizationId,
    status: { $in: Array.from(CAPACITY_AFFECTING_STATUSES) },
    createdAt: { $gte: start, $lte: end }
  })
    .select({ _id: 1, employeeId: 1, projectId: 1, createdAt: 1 })
    .lean();

  const byEmployee = new Map();
  for (const assignment of assignments) {
    if (!assignment.employeeId) {
      continue;
    }
    const key = assignment.employeeId.toString();
    if (!byEmployee.has(key)) {
      byEmployee.set(key, { count: 0, assignmentIds: [] });
    }
    const bucket = byEmployee.get(key);
    bucket.count += 1;
    bucket.assignmentIds.push(assignment._id);
  }

  const signals = [];

  for (const [employeeId, summary] of byEmployee.entries()) {
    if (summary.count <= maxAssignments) {
      continue;
    }

    const fingerprint = buildFingerprint({
      organizationId,
      ruleId: rule._id.toString(),
      ruleVersion: rule.version,
      subjectType: 'employee',
      subjectId: employeeId,
      windowStart: start,
      windowEnd: end
    });

    const signal = await ComplianceSignal.findOneAndUpdate(
      { organizationId, fingerprint },
      {
        $setOnInsert: {
          organizationId,
          ruleId: rule._id,
          ruleKey: rule.key,
          ruleVersion: rule.version,
          subject: { type: 'employee', id: employeeId },
          severity: rule.severity || 'low',
          status: 'active',
          computedAt: asOf,
          evaluationWindow: { start, end },
          assignmentIds: summary.assignmentIds,
          metrics: { assignmentCount: summary.count, maxAssignments },
          explanation: `Employee has ${summary.count} assignments within the evaluation window.`,
          fingerprint
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    signals.push(signal);
  }

  return {
    windowStart: start,
    windowEnd: end,
    evaluatedAssignments: assignments.length,
    triggeredSignals: signals
  };
};

const evaluateRulesForOrganization = async ({ organizationId, actorId, asOf } = {}) => {
  const orgId = normalizeObjectId(organizationId, 'organizationId', true);
  const actor = normalizeObjectId(actorId, 'actorId', false);
  const evaluationTime = asOf ? new Date(asOf) : new Date();

  ensure(!Number.isNaN(evaluationTime.getTime()), 'asOf must be a valid date', 'COMPLIANCE_INPUT_INVALID');

  const rules = await ComplianceRule.find({ organizationId: orgId, enabled: true }).sort({ createdAt: 1 }).lean();
  const results = [];

  for (const rule of rules) {
    if (rule.ruleType !== RULE_TYPE_MAX_ASSIGNMENTS) {
      await logEvaluation({
        organizationId: orgId,
        actorId: actor,
        ruleId: rule._id,
        signalId: null,
        context: {
          status: 'skipped',
          reason: 'Unsupported rule type in current implementation',
          ruleType: rule.ruleType,
          correlationId: `${orgId}:${rule._id}:${evaluationTime.toISOString()}`
        }
      });

      results.push({ ruleId: rule._id, status: 'skipped' });
      continue;
    }

    try {
      const evaluation = await evaluateMaxAssignmentsRule({ organizationId: orgId, rule, asOf: evaluationTime });
      const signalIds = evaluation.triggeredSignals.map((signal) => signal._id);

      await logEvaluation({
        organizationId: orgId,
        actorId: actor,
        ruleId: rule._id,
        signalId: signalIds[0] || null,
        context: {
          status: 'evaluated',
          ruleType: rule.ruleType,
          evaluationWindow: { start: evaluation.windowStart, end: evaluation.windowEnd },
          evaluatedAssignments: evaluation.evaluatedAssignments,
          signalIds,
          correlationId: `${orgId}:${rule._id}:${evaluationTime.toISOString()}`
        }
      });

      results.push({
        ruleId: rule._id,
        status: 'evaluated',
        signalIds
      });
    } catch (err) {
      await logEvaluation({
        organizationId: orgId,
        actorId: actor,
        ruleId: rule._id,
        signalId: null,
        context: {
          status: 'error',
          ruleType: rule.ruleType,
          message: err.message,
          code: err.code || 'COMPLIANCE_RULE_ERROR',
          correlationId: `${orgId}:${rule._id}:${evaluationTime.toISOString()}`
        }
      });

      results.push({ ruleId: rule._id, status: 'error', error: err.message });
    }
  }

  return {
    organizationId: orgId,
    evaluatedAt: evaluationTime,
    rulesEvaluated: results.length,
    results
  };
};

module.exports = { evaluateRulesForOrganization };
