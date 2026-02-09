const crypto = require('crypto');
const mongoose = require('mongoose');

const DeveloperActivity = require('../models/DeveloperActivity');
const ProductivityMetric = require('../models/ProductivityMetric');
const ProductivitySignal = require('../models/ProductivitySignal');
const auditLogService = require('../../compliance-audit/services/auditLogService');

// This service computes trend-only insights from Git-based events.
// It does not infer effort, hours worked, or rank developers.

const METRIC_KEY_PR_TURNAROUND = 'pr_turnaround_avg_hours';
const SIGNAL_KEY_PR_TREND = 'pr_turnaround_trend_change';
const METRIC_VERSION = 1;
const SIGNAL_VERSION = 1;

const DEFAULT_WINDOW = { value: 30, unit: 'day' };
const EVENT_TYPES = ['pr_opened', 'pr_merged'];

// Explicit thresholds keep insights explainable and configurable.
const MIN_CHANGE_HOURS = 8;
const MIN_CHANGE_PERCENT = 0.2;

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

const normalizeWindow = (window) => {
  const value = Number(window?.value ?? DEFAULT_WINDOW.value);
  const unit = window?.unit ?? DEFAULT_WINDOW.unit;

  ensure(Number.isFinite(value) && value > 0, 'window.value must be greater than zero', 'PRODUCTIVITY_INPUT_INVALID');
  ensure(['day', 'week', 'month'].includes(unit), 'window.unit is invalid', 'PRODUCTIVITY_INPUT_INVALID');

  return { value, unit };
};

const computeWindow = (window, asOf) => {
  const end = new Date(asOf);
  const start = new Date(asOf);

  if (window.unit === 'month') {
    start.setMonth(start.getMonth() - window.value);
  } else {
    const days = window.unit === 'week' ? window.value * 7 : window.value;
    start.setTime(start.getTime() - (days * 24 * 60 * 60 * 1000));
  }

  return { start, end };
};

const buildFingerprint = (parts) => crypto.createHash('sha256').update(parts.join('|')).digest('hex');

const buildMetricFingerprint = ({ organizationId, subjectType, subjectId, periodStart, periodEnd }) => buildFingerprint([
  organizationId,
  METRIC_KEY_PR_TURNAROUND,
  METRIC_VERSION,
  subjectType,
  subjectId,
  periodStart.toISOString(),
  periodEnd.toISOString()
]);

const buildSignalFingerprint = ({ organizationId, subjectType, subjectId, windowStart, windowEnd }) => buildFingerprint([
  organizationId,
  SIGNAL_KEY_PR_TREND,
  SIGNAL_VERSION,
  subjectType,
  subjectId,
  windowStart.toISOString(),
  windowEnd.toISOString()
]);

const getRepositoryKey = (activity) => activity.repository?.id || activity.repository?.name || 'unknown-repo';
const getPullRequestKey = (activity) => activity.metadata?.prId || activity.metadata?.pullRequestId || activity.metadata?.prNumber || null;

const groupTurnaroundsByDeveloper = ({ activities, windowStart, windowEnd }) => {
  const prMap = new Map();

  for (const activity of activities) {
    const prKey = getPullRequestKey(activity);
    if (!prKey) {
      continue;
    }

    const repoKey = getRepositoryKey(activity);
    const mapKey = `${repoKey}:${prKey}`;

    if (!prMap.has(mapKey)) {
      prMap.set(mapKey, {
        openedAt: null,
        openedBy: null,
        mergedAt: null
      });
    }

    const entry = prMap.get(mapKey);

    if (activity.eventType === 'pr_opened') {
      // Use the earliest open event to keep the turnaround deterministic.
      if (!entry.openedAt || activity.eventAt < entry.openedAt) {
        entry.openedAt = activity.eventAt;
        entry.openedBy = activity.developerId?.toString() || null;
      }
    }

    if (activity.eventType === 'pr_merged') {
      // Use the earliest merge event to avoid inflating turnaround time.
      if (!entry.mergedAt || activity.eventAt < entry.mergedAt) {
        entry.mergedAt = activity.eventAt;
      }
    }
  }

  const byDeveloper = new Map();

  for (const entry of prMap.values()) {
    if (!entry.openedAt || !entry.mergedAt || !entry.openedBy) {
      continue;
    }

    if (entry.mergedAt < windowStart || entry.mergedAt > windowEnd) {
      continue;
    }

    const durationMs = entry.mergedAt.getTime() - entry.openedAt.getTime();
    if (durationMs < 0) {
      continue;
    }

    if (!byDeveloper.has(entry.openedBy)) {
      byDeveloper.set(entry.openedBy, { totalMs: 0, count: 0 });
    }

    const bucket = byDeveloper.get(entry.openedBy);
    bucket.totalMs += durationMs;
    bucket.count += 1;
  }

  return byDeveloper;
};

const averageHours = ({ totalMs, count }) => (count > 0 ? totalMs / count / (1000 * 60 * 60) : null);

const computePrTurnaroundTrend = async ({ organizationId, actorId, asOf, window } = {}) => {
  const orgId = normalizeObjectId(organizationId, 'organizationId', true);
  const actor = normalizeObjectId(actorId, 'actorId', false);
  const evaluationTime = asOf ? new Date(asOf) : new Date();

  ensure(!Number.isNaN(evaluationTime.getTime()), 'asOf must be a valid date', 'PRODUCTIVITY_INPUT_INVALID');

  const normalizedWindow = normalizeWindow(window);
  const currentWindow = computeWindow(normalizedWindow, evaluationTime);

  const previousEnd = new Date(currentWindow.start);
  const previousWindow = computeWindow(normalizedWindow, previousEnd);

  const activities = await DeveloperActivity.find({
    organizationId: orgId,
    eventType: { $in: EVENT_TYPES },
    eventAt: { $gte: previousWindow.start, $lte: currentWindow.end }
  })
    .select({ _id: 1, developerId: 1, eventType: 1, eventAt: 1, repository: 1, metadata: 1 })
    .lean();

  const currentByDeveloper = groupTurnaroundsByDeveloper({
    activities,
    windowStart: currentWindow.start,
    windowEnd: currentWindow.end
  });

  const previousByDeveloper = groupTurnaroundsByDeveloper({
    activities,
    windowStart: previousWindow.start,
    windowEnd: previousWindow.end
  });

  const metrics = [];
  const signals = [];

  for (const [developerId, summary] of currentByDeveloper.entries()) {
    const avgHours = averageHours(summary);
    if (avgHours === null) {
      continue;
    }

    const metricFingerprint = buildMetricFingerprint({
      organizationId: orgId,
      subjectType: 'developer',
      subjectId: developerId,
      periodStart: currentWindow.start,
      periodEnd: currentWindow.end
    });

    const metric = await ProductivityMetric.findOneAndUpdate(
      { organizationId: orgId, fingerprint: metricFingerprint },
      {
        $setOnInsert: {
          organizationId: orgId,
          metricKey: METRIC_KEY_PR_TURNAROUND,
          metricVersion: METRIC_VERSION,
          subject: { type: 'developer', id: developerId },
          window: normalizedWindow,
          period: { start: currentWindow.start, end: currentWindow.end },
          value: avgHours,
          unit: 'hours',
          inputs: { sampleSize: summary.count },
          computedAt: evaluationTime,
          fingerprint: metricFingerprint
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    metrics.push(metric);

    await auditLogService.create({
      organizationId: orgId,
      actorId: actor || undefined,
      eventType: 'PRODUCTIVITY_METRIC_COMPUTED',
      ruleId: undefined,
      signalId: undefined,
      context: {
        metricKey: METRIC_KEY_PR_TURNAROUND,
        subjectType: 'developer',
        subjectId: developerId,
        period: { start: currentWindow.start, end: currentWindow.end },
        value: avgHours,
        sampleSize: summary.count
      },
      occurredAt: evaluationTime,
      correlationId: `${orgId}:${METRIC_KEY_PR_TURNAROUND}:${metricFingerprint}`
    });

    const previousSummary = previousByDeveloper.get(developerId);
    if (!previousSummary || previousSummary.count === 0) {
      continue;
    }

    const previousAvgHours = averageHours(previousSummary);
    if (previousAvgHours === null) {
      continue;
    }

    const deltaHours = avgHours - previousAvgHours;
    const percentChange = previousAvgHours > 0 ? deltaHours / previousAvgHours : null;
    const significantChange = Math.abs(deltaHours) >= MIN_CHANGE_HOURS
      || (percentChange !== null && Math.abs(percentChange) >= MIN_CHANGE_PERCENT);

    if (!significantChange) {
      continue;
    }

    const direction = deltaHours >= 0 ? 'increased' : 'decreased';
    const signalFingerprint = buildSignalFingerprint({
      organizationId: orgId,
      subjectType: 'developer',
      subjectId: developerId,
      windowStart: currentWindow.start,
      windowEnd: currentWindow.end
    });

    const signal = await ProductivitySignal.findOneAndUpdate(
      { organizationId: orgId, fingerprint: signalFingerprint },
      {
        $setOnInsert: {
          organizationId: orgId,
          signalKey: SIGNAL_KEY_PR_TREND,
          signalVersion: SIGNAL_VERSION,
          subject: { type: 'developer', id: developerId },
          severity: 'low',
          status: 'active',
          evaluationWindow: { start: currentWindow.start, end: currentWindow.end },
          metricIds: [metric._id],
          activityIds: [],
          context: {
            previousAverageHours: previousAvgHours,
            currentAverageHours: avgHours,
            deltaHours,
            percentChange,
            thresholdHours: MIN_CHANGE_HOURS,
            thresholdPercent: MIN_CHANGE_PERCENT,
            sampleSize: summary.count,
            previousSampleSize: previousSummary.count
          },
          explanation: `Average PR turnaround ${direction} from ${previousAvgHours.toFixed(1)}h to ${avgHours.toFixed(1)}h compared to the prior window.`,
          computedAt: evaluationTime,
          fingerprint: signalFingerprint
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    signals.push(signal);

    await auditLogService.create({
      organizationId: orgId,
      actorId: actor || undefined,
      eventType: 'PRODUCTIVITY_SIGNAL_EMITTED',
      ruleId: undefined,
      signalId: signal._id,
      context: {
        signalKey: SIGNAL_KEY_PR_TREND,
        subjectType: 'developer',
        subjectId: developerId,
        evaluationWindow: { start: currentWindow.start, end: currentWindow.end }
      },
      occurredAt: evaluationTime,
      correlationId: `${orgId}:${SIGNAL_KEY_PR_TREND}:${signalFingerprint}`
    });
  }

  return {
    organizationId: orgId,
    evaluatedAt: evaluationTime,
    window: normalizedWindow,
    metricsComputed: metrics.length,
    signalsEmitted: signals.length
  };
};

module.exports = {
  computePrTurnaroundTrend
};
