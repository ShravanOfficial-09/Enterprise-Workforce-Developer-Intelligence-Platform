const crypto = require('crypto');
const mongoose = require('mongoose');

const BurnoutRiskRule = require('../models/BurnoutRiskRule');
const BurnoutRiskSignal = require('../models/BurnoutRiskSignal');
const ComplianceSignal = require('../../compliance-audit/models/ComplianceSignal');
const ProductivitySignal = require('../../productivity-intelligence/models/ProductivitySignal');
const auditLogService = require('../../compliance-audit/services/auditLogService');

// This service correlates existing system signals to surface risk indicators.
// It does not access raw activity, does not score, and does not diagnose.

const DEFAULT_RULE_KEY = 'MULTI_SIGNAL_CORRELATION';
const SUPPORTED_SUBJECT_TYPES = ['organization', 'team'];

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

const computeWindow = (window, asOf) => {
  ensure(window && typeof window === 'object', 'evaluationWindow is required', 'BURNOUT_RULE_INVALID');
  const value = Number(window.value);
  const unit = window.unit;

  ensure(Number.isFinite(value) && value > 0, 'evaluationWindow.value must be greater than zero', 'BURNOUT_RULE_INVALID');
  ensure(['day', 'week', 'month'].includes(unit), 'evaluationWindow.unit is invalid', 'BURNOUT_RULE_INVALID');

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

const safeLoadAllocationSignalModel = () => {
  try {
    // Allocation-derived signals may be emitted by Part 1 in the future.
    // This optional dependency keeps the correlation logic read-only.
    // eslint-disable-next-line global-require
    return require('../../workforce-allocation/models/AllocationSignal');
  } catch (err) {
    if (err && err.code === 'MODULE_NOT_FOUND') {
      return null;
    }
    throw err;
  }
};

const fetchComplianceSignals = async ({ organizationId, windowStart, windowEnd }) => ComplianceSignal.find({
  organizationId,
  status: 'active',
  computedAt: { $gte: windowStart, $lte: windowEnd },
  'subject.type': { $in: SUPPORTED_SUBJECT_TYPES }
})
  .select({ _id: 1, ruleKey: 1, subject: 1, computedAt: 1 })
  .lean();

const fetchProductivitySignals = async ({ organizationId, windowStart, windowEnd }) => ProductivitySignal.find({
  organizationId,
  status: 'active',
  computedAt: { $gte: windowStart, $lte: windowEnd },
  'subject.type': { $in: SUPPORTED_SUBJECT_TYPES }
})
  .select({ _id: 1, signalKey: 1, subject: 1, computedAt: 1 })
  .lean();

const fetchAllocationSignals = async ({ organizationId, windowStart, windowEnd }) => {
  const AllocationSignal = safeLoadAllocationSignalModel();
  if (!AllocationSignal) {
    return [];
  }

  return AllocationSignal.find({
    organizationId,
    status: 'active',
    computedAt: { $gte: windowStart, $lte: windowEnd },
    'subject.type': { $in: SUPPORTED_SUBJECT_TYPES }
  })
    .select({ _id: 1, signalKey: 1, subject: 1, computedAt: 1 })
    .lean();
};

const upsertRiskSignal = async ({ organizationId, rule, subject, window, sourceSignals, context, asOf }) => {
  const fingerprint = buildFingerprint({
    organizationId,
    ruleId: rule._id.toString(),
    ruleVersion: rule.version,
    subjectType: subject.type,
    subjectId: subject.id.toString(),
    windowStart: window.start,
    windowEnd: window.end
  });

  return BurnoutRiskSignal.findOneAndUpdate(
    { organizationId, fingerprint },
    {
      $setOnInsert: {
        organizationId,
        ruleId: rule._id,
        ruleKey: rule.key,
        ruleVersion: rule.version,
        subject,
        severity: rule.severity || 'low',
        status: 'active',
        evaluationWindow: { start: window.start, end: window.end },
        sourceSignals,
        context,
        explanation: context?.explanation || 'Correlated multiple system signals within the evaluation window.',
        computedAt: asOf,
        fingerprint
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

const evaluateCorrelationRule = async ({ organizationId, rule, asOf }) => {
  if (!SUPPORTED_SUBJECT_TYPES.includes(rule.scope)) {
    return {
      window: null,
      signals: [],
      status: 'skipped',
      reason: `Rule scope ${rule.scope} is not supported in the initial correlation.`
    };
  }

  const window = computeWindow(rule.evaluationWindow, asOf);

  const [complianceSignals, productivitySignals, allocationSignals] = await Promise.all([
    fetchComplianceSignals({ organizationId, windowStart: window.start, windowEnd: window.end }),
    fetchProductivitySignals({ organizationId, windowStart: window.start, windowEnd: window.end }),
    fetchAllocationSignals({ organizationId, windowStart: window.start, windowEnd: window.end })
  ]);

  const bySubject = new Map();

  const addSignal = (source, signal) => {
    if (!signal?.subject?.type || !signal?.subject?.id) {
      return;
    }

    const subjectKey = `${signal.subject.type}:${signal.subject.id}`;
    if (!bySubject.has(subjectKey)) {
      bySubject.set(subjectKey, {
        subject: { type: signal.subject.type, id: signal.subject.id },
        sources: new Map(),
        sourceSignals: []
      });
    }

    const entry = bySubject.get(subjectKey);

    if (!entry.sources.has(source)) {
      entry.sources.set(source, 0);
    }

    entry.sources.set(source, entry.sources.get(source) + 1);
    entry.sourceSignals.push({
      source,
      signalId: signal._id,
      signalKey: signal.signalKey || signal.ruleKey || 'unknown'
    });
  };

  complianceSignals.forEach((signal) => addSignal('compliance', signal));
  productivitySignals.forEach((signal) => addSignal('productivity', signal));
  allocationSignals.forEach((signal) => addSignal('allocation', signal));

  const emittedSignals = [];

  for (const entry of bySubject.values()) {
    const distinctSources = Array.from(entry.sources.keys());

    // Correlation requires at least two different signal types.
    if (distinctSources.length < 2) {
      continue;
    }

    const context = {
      sources: distinctSources,
      countsBySource: Object.fromEntries(entry.sources),
      explanation: `Signals from ${distinctSources.join(' + ')} were observed in the evaluation window.`
    };

    const signal = await upsertRiskSignal({
      organizationId,
      rule,
      subject: entry.subject,
      window,
      sourceSignals: entry.sourceSignals,
      context,
      asOf
    });

    emittedSignals.push(signal);
  }

  return {
    window,
    signals: emittedSignals,
    status: 'evaluated',
    counts: {
      compliance: complianceSignals.length,
      productivity: productivitySignals.length,
      allocation: allocationSignals.length
    }
  };
};

const evaluateBurnoutRisk = async ({ organizationId, actorId, ruleKey, asOf } = {}) => {
  const orgId = normalizeObjectId(organizationId, 'organizationId', true);
  const actor = normalizeObjectId(actorId, 'actorId', false);
  const evaluationTime = asOf ? new Date(asOf) : new Date();

  ensure(!Number.isNaN(evaluationTime.getTime()), 'asOf must be a valid date', 'BURNOUT_INPUT_INVALID');

  const ruleIdentifier = ruleKey || DEFAULT_RULE_KEY;
  const rule = await BurnoutRiskRule.findOne({ organizationId: orgId, key: ruleIdentifier, enabled: true }).lean();

  ensure(rule, 'Burnout risk rule not found or disabled', 'BURNOUT_RULE_NOT_FOUND');

  const evaluation = await evaluateCorrelationRule({ organizationId: orgId, rule, asOf: evaluationTime });
  const signalIds = evaluation.signals.map((signal) => signal._id);

  await auditLogService.create({
    organizationId: orgId,
    actorId: actor || undefined,
    eventType: 'BURNOUT_RISK_RULE_EVALUATED',
    ruleId: rule._id,
    signalId: signalIds[0] || undefined,
    context: {
      status: evaluation.status,
      ruleKey: rule.key,
      ruleVersion: rule.version,
      evaluationWindow: evaluation.window ? { start: evaluation.window.start, end: evaluation.window.end } : null,
      sourceCounts: evaluation.counts || {},
      emittedSignalIds: signalIds
    },
    occurredAt: evaluationTime,
    correlationId: `${orgId}:${rule._id}:${evaluationTime.toISOString()}`
  });

  for (const signal of evaluation.signals) {
    await auditLogService.create({
      organizationId: orgId,
      actorId: actor || undefined,
      eventType: 'BURNOUT_RISK_SIGNAL_EMITTED',
      ruleId: rule._id,
      signalId: signal._id,
      context: {
        ruleKey: rule.key,
        ruleVersion: rule.version,
        subject: signal.subject,
        evaluationWindow: signal.evaluationWindow
      },
      occurredAt: evaluationTime,
      correlationId: `${orgId}:${rule._id}:${signal.fingerprint}`
    });
  }

  return {
    organizationId: orgId,
    evaluatedAt: evaluationTime,
    ruleId: rule._id,
    signalsEmitted: evaluation.signals.length
  };
};

module.exports = {
  evaluateBurnoutRisk
};
