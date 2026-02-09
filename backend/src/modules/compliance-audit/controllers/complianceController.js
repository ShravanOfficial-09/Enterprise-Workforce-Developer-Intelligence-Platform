const complianceReadService = require('../services/complianceReadService');

const ERROR_STATUS_MAP = {
  COMPLIANCE_INPUT_INVALID: 400
};

const resolveOrganizationId = (req) => req.query.organizationId || req.user?.organizationId || req.user?.orgId || null;

const handleServiceError = (err, res, next) => {
  if (!err || !err.code || !ERROR_STATUS_MAP[err.code]) {
    return next(err);
  }

  return res.status(ERROR_STATUS_MAP[err.code]).json({ message: err.message, code: err.code });
};

exports.listSignals = async (req, res, next) => {
  try {
    const organizationId = resolveOrganizationId(req);
    if (!organizationId) {
      return res.status(400).json({ message: 'organizationId is required' });
    }

    const signals = await complianceReadService.listSignals({
      organizationId,
      status: req.query.status || 'active',
      severity: req.query.severity,
      subjectType: req.query.subjectType,
      subjectId: req.query.subjectId,
      ruleId: req.query.ruleId,
      ruleKey: req.query.ruleKey,
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

exports.listAuditLogs = async (req, res, next) => {
  try {
    const organizationId = resolveOrganizationId(req);
    if (!organizationId) {
      return res.status(400).json({ message: 'organizationId is required' });
    }

    const logs = await complianceReadService.listAuditLogs({
      organizationId,
      ruleId: req.query.ruleId,
      signalId: req.query.signalId,
      eventType: req.query.eventType,
      correlationId: req.query.correlationId,
      occurredAfter: req.query.occurredAfter,
      occurredBefore: req.query.occurredBefore,
      limit: req.query.limit,
      skip: req.query.skip
    });

    return res.json({ data: logs });
  } catch (err) {
    return handleServiceError(err, res, next);
  }
};
