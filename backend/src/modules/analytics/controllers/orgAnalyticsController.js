const orgAnalyticsService = require('../services/orgAnalyticsService');

const ERROR_STATUS_MAP = {
  ANALYTICS_INPUT_INVALID: 400
};

const resolveOrganizationId = (req) => req.query.organizationId || req.user?.organizationId || req.user?.orgId || null;

const handleServiceError = (err, res, next) => {
  if (!err || !err.code || !ERROR_STATUS_MAP[err.code]) {
    return next(err);
  }

  return res.status(ERROR_STATUS_MAP[err.code]).json({ message: err.message, code: err.code });
};

exports.getOrgOverview = async (req, res, next) => {
  try {
    const organizationId = resolveOrganizationId(req);
    if (!organizationId) {
      return res.status(400).json({ message: 'organizationId is required' });
    }

    const overview = await orgAnalyticsService.getOrgOverview({
      organizationId,
      metricKey: req.query.metricKey,
      window: {
        value: req.query.windowValue,
        unit: req.query.windowUnit
      },
      asOf: req.query.asOf
    });

    return res.json({ data: overview });
  } catch (err) {
    return handleServiceError(err, res, next);
  }
};
