const mongoose = require('mongoose');

const ProductivityMetric = require('../models/ProductivityMetric');
const ProductivitySignal = require('../models/ProductivitySignal');

// Read-only queries for productivity metrics and signals. No mutation or recomputation.

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

  ensure(value, `${fieldName} is required`, 'PRODUCTIVITY_INPUT_INVALID');
  ensure(mongoose.Types.ObjectId.isValid(value), `${fieldName} must be a valid ObjectId`, 'PRODUCTIVITY_INPUT_INVALID');
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
  ensure(!Number.isNaN(date.getTime()), `${fieldName} must be a valid date`, 'PRODUCTIVITY_INPUT_INVALID');
  return date;
};

const listMetrics = async ({
  organizationId,
  metricKey,
  subjectType,
  subjectId,
  periodStartAfter,
  periodEndBefore,
  computedAfter,
  computedBefore,
  limit,
  skip
} = {}) => {
  const orgId = normalizeObjectId(organizationId, 'organizationId', true);

  const filter = { organizationId: orgId };

  if (metricKey) {
    filter.metricKey = metricKey;
  }

  if (subjectType) {
    filter['subject.type'] = subjectType;
  }

  if (subjectId) {
    filter['subject.id'] = normalizeObjectId(subjectId, 'subjectId', true);
  }

  const periodStart = parseDate(periodStartAfter, 'periodStartAfter');
  if (periodStart) {
    filter['period.start'] = { $gte: periodStart };
  }

  const periodEnd = parseDate(periodEndBefore, 'periodEndBefore');
  if (periodEnd) {
    filter['period.end'] = { $lte: periodEnd };
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

  return ProductivityMetric.find(filter)
    .sort({ computedAt: -1 })
    .skip(parseSkip(skip))
    .limit(parseLimit(limit))
    .lean();
};

const listSignals = async ({
  organizationId,
  signalKey,
  subjectType,
  subjectId,
  status,
  severity,
  computedAfter,
  computedBefore,
  limit,
  skip
} = {}) => {
  const orgId = normalizeObjectId(organizationId, 'organizationId', true);

  const filter = { organizationId: orgId };

  if (signalKey) {
    filter.signalKey = signalKey;
  }

  if (subjectType) {
    filter['subject.type'] = subjectType;
  }

  if (subjectId) {
    filter['subject.id'] = normalizeObjectId(subjectId, 'subjectId', true);
  }

  if (status) {
    filter.status = status;
  }

  if (severity) {
    filter.severity = severity;
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

  return ProductivitySignal.find(filter)
    .sort({ computedAt: -1 })
    .skip(parseSkip(skip))
    .limit(parseLimit(limit))
    .lean();
};

module.exports = {
  listMetrics,
  listSignals
};
