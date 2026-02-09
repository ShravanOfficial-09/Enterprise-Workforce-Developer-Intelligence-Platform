const mongoose = require('mongoose');

const Assignment = require('../../workforce-allocation/models/Assignment');
const ComplianceSignal = require('../../compliance-audit/models/ComplianceSignal');
const BurnoutRiskSignal = require('../../burnout-risk/models/BurnoutRiskSignal');
const ProductivitySignal = require('../../productivity-intelligence/models/ProductivitySignal');
const ProductivityMetric = require('../../productivity-intelligence/models/ProductivityMetric');

// Read-only org analytics aggregation. No mutation or recomputation.

const DEFAULT_WINDOW = { value: 30, unit: 'day' };

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

  ensure(value, `${fieldName} is required`, 'ANALYTICS_INPUT_INVALID');
  ensure(mongoose.Types.ObjectId.isValid(value), `${fieldName} must be a valid ObjectId`, 'ANALYTICS_INPUT_INVALID');
  return value.toString();
};

const normalizeWindow = (window) => {
  const value = Number(window?.value ?? DEFAULT_WINDOW.value);
  const unit = window?.unit ?? DEFAULT_WINDOW.unit;

  ensure(Number.isFinite(value) && value > 0, 'window.value must be greater than zero', 'ANALYTICS_INPUT_INVALID');
  ensure(['day', 'week', 'month'].includes(unit), 'window.unit is invalid', 'ANALYTICS_INPUT_INVALID');

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

const getAllocationDistribution = async (organizationId) => Assignment.aggregate([
  { $match: { organizationId } },
  {
    $group: {
      _id: '$status',
      count: { $sum: 1 },
      totalUnits: { $sum: { $ifNull: ['$allocation.units', 0] } }
    }
  },
  { $sort: { _id: 1 } }
]);

const getComplianceRiskCounts = async (organizationId) => ComplianceSignal.aggregate([
  { $match: { organizationId, status: 'active' } },
  { $group: { _id: '$severity', count: { $sum: 1 } } },
  { $sort: { _id: 1 } }
]);

const getBurnoutRiskCount = async (organizationId) => BurnoutRiskSignal.countDocuments({
  organizationId,
  status: 'active'
});

const getProductivitySignalSummary = async (organizationId) => ProductivitySignal.aggregate([
  { $match: { organizationId, status: 'active' } },
  { $group: { _id: '$signalKey', count: { $sum: 1 } } },
  { $sort: { _id: 1 } }
]);

const getProductivityMetricSummary = async ({ organizationId, metricKey, window, asOf }) => {
  if (!metricKey) {
    return null;
  }

  const period = computeWindow(window, asOf);

  const result = await ProductivityMetric.aggregate([
    {
      $match: {
        organizationId,
        metricKey,
        computedAt: { $gte: period.start, $lte: period.end }
      }
    },
    {
      $group: {
        _id: '$metricKey',
        metricCount: { $sum: 1 },
        averageValue: { $avg: '$value' },
        latestComputedAt: { $max: '$computedAt' }
      }
    }
  ]);

  if (!result.length) {
    return {
      metricKey,
      metricCount: 0,
      averageValue: null,
      latestComputedAt: null,
      window: period
    };
  }

  return {
    metricKey,
    metricCount: result[0].metricCount,
    averageValue: result[0].averageValue,
    latestComputedAt: result[0].latestComputedAt,
    window: period
  };
};

const getOrgOverview = async ({ organizationId, metricKey, window, asOf } = {}) => {
  const orgId = normalizeObjectId(organizationId, 'organizationId', true);
  const evaluationTime = asOf ? new Date(asOf) : new Date();

  ensure(!Number.isNaN(evaluationTime.getTime()), 'asOf must be a valid date', 'ANALYTICS_INPUT_INVALID');

  const orgObjectId = new mongoose.Types.ObjectId(orgId);
  const normalizedWindow = normalizeWindow(window);

  const [
    allocationDistribution,
    complianceRiskCounts,
    burnoutRiskCount,
    productivitySignalSummary,
    productivityMetricSummary
  ] = await Promise.all([
    getAllocationDistribution(orgObjectId),
    getComplianceRiskCounts(orgObjectId),
    getBurnoutRiskCount(orgObjectId),
    getProductivitySignalSummary(orgObjectId),
    getProductivityMetricSummary({
      organizationId: orgObjectId,
      metricKey,
      window: normalizedWindow,
      asOf: evaluationTime
    })
  ]);

  return {
    organizationId: orgId,
    generatedAt: evaluationTime,
    workforceAllocation: {
      distributionByStatus: allocationDistribution
    },
    complianceRisks: {
      activeBySeverity: complianceRiskCounts
    },
    burnoutRisk: {
      activeSignals: burnoutRiskCount
    },
    productivity: {
      activeSignalsByKey: productivitySignalSummary,
      metricSummary: productivityMetricSummary
    }
  };
};

module.exports = {
  getOrgOverview
};
