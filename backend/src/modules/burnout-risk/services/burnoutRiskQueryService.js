const mongoose = require('mongoose');

const BurnoutRiskRule = require('../models/BurnoutRiskRule');
const BurnoutRiskSignal = require('../models/BurnoutRiskSignal');

// Read-only queries for burnout risk rules and signals. No mutation or evaluation.

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

  ensure(value, `${fieldName} is required`, 'BURNOUT_INPUT_INVALID');
  ensure(mongoose.Types.ObjectId.isValid(value), `${fieldName} must be a valid ObjectId`, 'BURNOUT_INPUT_INVALID');
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
  ensure(!Number.isNaN(date.getTime()), `${fieldName} must be a valid date`, 'BURNOUT_INPUT_INVALID');
  return date;
};

const parseBoolean = (value) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  if (value === true || value === 'true') {
    return true;
  }
  if (value === false || value === 'false') {
    return false;
  }
  return null;
};

const listRules = async ({
  organizationId,
  key,
  version,
  enabled,
  scope,
  severity,
  limit,
  skip
} = {}) => {
  const orgId = normalizeObjectId(organizationId, 'organizationId', true);

  const filter = { organizationId: orgId };

  if (key) {
    filter.key = key;
  }

  if (version) {
    const parsedVersion = Number(version);
    ensure(Number.isFinite(parsedVersion) && parsedVersion > 0, 'version must be a positive number', 'BURNOUT_INPUT_INVALID');
    filter.version = parsedVersion;
  }

  const enabledValue = parseBoolean(enabled);
  if (enabledValue !== null) {
    filter.enabled = enabledValue;
  }

  if (scope) {
    filter.scope = scope;
  }

  if (severity) {
    filter.severity = severity;
  }

  return BurnoutRiskRule.find(filter)
    .sort({ createdAt: -1 })
    .skip(parseSkip(skip))
    .limit(parseLimit(limit))
    .lean();
};

const listSignals = async ({
  organizationId,
  ruleId,
  ruleKey,
  status,
  severity,
  subjectType,
  subjectId,
  computedAfter,
  computedBefore,
  windowStartAfter,
  windowEndBefore,
  limit,
  skip
} = {}) => {
  const orgId = normalizeObjectId(organizationId, 'organizationId', true);

  const filter = { organizationId: orgId };

  if (ruleId) {
    filter.ruleId = normalizeObjectId(ruleId, 'ruleId', true);
  }

  if (ruleKey) {
    filter.ruleKey = ruleKey;
  }

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

  const computedAfterDate = parseDate(computedAfter, 'computedAfter');
  const computedBeforeDate = parseDate(computedBefore, 'computedBefore');
  if (computedAfterDate || computedBeforeDate) {
    filter.computedAt = {};
    if (computedAfterDate) {
      filter.computedAt.$gte = computedAfterDate;
    }
    if (computedBeforeDate) {
      filter.computedAt.$lte = computedBeforeDate;
    }
  }

  const windowStartDate = parseDate(windowStartAfter, 'windowStartAfter');
  const windowEndDate = parseDate(windowEndBefore, 'windowEndBefore');
  if (windowStartDate) {
    filter['evaluationWindow.start'] = { $gte: windowStartDate };
  }
  if (windowEndDate) {
    filter['evaluationWindow.end'] = Object.assign(filter['evaluationWindow.end'] || {}, { $lte: windowEndDate });
  }

  return BurnoutRiskSignal.find(filter)
    .sort({ computedAt: -1 })
    .skip(parseSkip(skip))
    .limit(parseLimit(limit))
    .lean();
};

module.exports = {
  listRules,
  listSignals
};
