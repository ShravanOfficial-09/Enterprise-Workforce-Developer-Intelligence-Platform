const mongoose = require('mongoose');

const ComplianceSignal = require('../models/ComplianceSignal');
const AuditLog = require('../models/AuditLog');

// Read-only queries for compliance data. No mutations are allowed here.

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

const parseLimit = (value, fallback = 50) => {
  const limit = Number(value);
  if (!Number.isFinite(limit)) {
    return fallback;
  }
  return Math.min(Math.max(limit, 1), 200);
};

const parseSkip = (value) => {
  const skip = Number(value);
  if (!Number.isFinite(skip) || skip < 0) {
    return 0;
  }
  return skip;
};

const parseDate = (value, fieldName) => {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  ensure(!Number.isNaN(date.getTime()), `${fieldName} must be a valid date`, 'COMPLIANCE_INPUT_INVALID');
  return date;
};

const listSignals = async ({
  organizationId,
  status,
  severity,
  subjectType,
  subjectId,
  ruleId,
  ruleKey,
  computedAfter,
  computedBefore,
  limit,
  skip
} = {}) => {
  const orgId = normalizeObjectId(organizationId, 'organizationId', true);

  const filter = { organizationId: orgId };

  if (status) {
    filter.status = status;
  }

  if (severity) {
    filter.severity = severity;
  }

  if (subjectType) {
    filter['subject.type'] = subjectType;
  }

  if (subjectId) {
    filter['subject.id'] = normalizeObjectId(subjectId, 'subjectId', true);
  }

  if (ruleId) {
    filter.ruleId = normalizeObjectId(ruleId, 'ruleId', true);
  }

  if (ruleKey) {
    filter.ruleKey = ruleKey;
  }

  const after = parseDate(computedAfter, 'computedAfter');
  const before = parseDate(computedBefore, 'computedBefore');
  if (after || before) {
    filter.computedAt = {};
    if (after) {
      filter.computedAt.$gte = after;
    }
    if (before) {
      filter.computedAt.$lte = before;
    }
  }

  return ComplianceSignal.find(filter)
    .sort({ computedAt: -1 })
    .skip(parseSkip(skip))
    .limit(parseLimit(limit))
    .lean();
};

const listAuditLogs = async ({
  organizationId,
  ruleId,
  signalId,
  eventType,
  correlationId,
  occurredAfter,
  occurredBefore,
  limit,
  skip
} = {}) => {
  const orgId = normalizeObjectId(organizationId, 'organizationId', true);

  const filter = { organizationId: orgId };

  if (ruleId) {
    filter.ruleId = normalizeObjectId(ruleId, 'ruleId', true);
  }

  if (signalId) {
    filter.signalId = normalizeObjectId(signalId, 'signalId', true);
  }

  if (eventType) {
    filter.eventType = eventType;
  }

  if (correlationId) {
    filter.correlationId = correlationId;
  }

  const after = parseDate(occurredAfter, 'occurredAfter');
  const before = parseDate(occurredBefore, 'occurredBefore');
  if (after || before) {
    filter.occurredAt = {};
    if (after) {
      filter.occurredAt.$gte = after;
    }
    if (before) {
      filter.occurredAt.$lte = before;
    }
  }

  return AuditLog.find(filter)
    .sort({ occurredAt: -1 })
    .skip(parseSkip(skip))
    .limit(parseLimit(limit))
    .lean();
};

module.exports = {
  listSignals,
  listAuditLogs
};
