const productivityReadService = require('../services/productivityReadService');

const ERROR_STATUS_MAP = {
  PRODUCTIVITY_INPUT_INVALID: 400
};

const resolveOrganizationId = (req) => req.query.organizationId || req.user?.organizationId || req.user?.orgId || null;

const handleServiceError = (err, res, next) => {
  if (!err || !err.code || !ERROR_STATUS_MAP[err.code]) {
    return next(err);
  }

  return res.status(ERROR_STATUS_MAP[err.code]).json({ message: err.message, code: err.code });
};

exports.listMetrics = async (req, res, next) => {
  try {
    const organizationId = resolveOrganizationId(req);
    if (!organizationId) {
      return res.status(400).json({ message: 'organizationId is required' });
    }

    const metrics = await productivityReadService.listMetrics({
      organizationId,
      metricKey: req.query.metricKey,
      subjectType: req.query.subjectType,
      subjectId: req.query.subjectId,
      periodStartAfter: req.query.periodStartAfter,
      periodEndBefore: req.query.periodEndBefore,
      computedAfter: req.query.computedAfter,
      computedBefore: req.query.computedBefore,
      limit: req.query.limit,
      skip: req.query.skip
    });

    return res.json({ data: metrics });
  } catch (err) {
    return handleServiceError(err, res, next);
  }
};

exports.listSignals = async (req, res, next) => {
  try {
    const organizationId = resolveOrganizationId(req);
    if (!organizationId) {
      return res.status(400).json({ message: 'organizationId is required' });
    }

    const signals = await productivityReadService.listSignals({
      organizationId,
      signalKey: req.query.signalKey,
      subjectType: req.query.subjectType,
      subjectId: req.query.subjectId,
      status: req.query.status || 'active',
      severity: req.query.severity,
      computedAfter: req.query.computedAfter,
      computedBefore: req.query.computedBefore,
      limit: req.query.limit,
      skip: req.query.skip
    });

    return res.json({ data: signals });
  } catch (err) {
    return handleServiceError(err, res, next);
  }
};
