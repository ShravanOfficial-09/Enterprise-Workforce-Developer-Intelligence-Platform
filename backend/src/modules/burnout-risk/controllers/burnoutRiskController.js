const burnoutRiskQueryService = require('../services/burnoutRiskQueryService');

const ERROR_STATUS_MAP = {
  BURNOUT_INPUT_INVALID: 400
};

const resolveOrganizationId = (req) => req.query.organizationId || req.user?.organizationId || req.user?.orgId || null;

const handleServiceError = (err, res, next) => {
  if (!err || !err.code || !ERROR_STATUS_MAP[err.code]) {
    return next(err);
  }

  return res.status(ERROR_STATUS_MAP[err.code]).json({ message: err.message, code: err.code });
};

exports.listRules = async (req, res, next) => {
  try {
    const organizationId = resolveOrganizationId(req);
    if (!organizationId) {
      return res.status(400).json({ message: 'organizationId is required' });
    }

    const rules = await burnoutRiskQueryService.listRules({
      organizationId,
      key: req.query.key,
      version: req.query.version,
      enabled: req.query.enabled,
      scope: req.query.scope,
      severity: req.query.severity,
      limit: req.query.limit,
      skip: req.query.skip
    });

    return res.json({ data: rules });
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

    const signals = await burnoutRiskQueryService.listSignals({
      organizationId,
      ruleId: req.query.ruleId,
      ruleKey: req.query.ruleKey,
      status: req.query.status || 'active',
      severity: req.query.severity,
      subjectType: req.query.subjectType,
      subjectId: req.query.subjectId,
      computedAfter: req.query.computedAfter,
      computedBefore: req.query.computedBefore,
      windowStartAfter: req.query.windowStartAfter,
      windowEndBefore: req.query.windowEndBefore,
      limit: req.query.limit,
      skip: req.query.skip
    });

    return res.json({ data: signals });
  } catch (err) {
    return handleServiceError(err, res, next);
  }
};
