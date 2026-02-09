const router = require('express').Router();
const mongoose = require('mongoose');

const { evaluateRulesForOrganization } = require('../../compliance-audit/services/complianceEvaluationService');
const { computePrTurnaroundTrend } = require('../../productivity-intelligence/services/productivityComputationService');
const { evaluateBurnoutRisk } = require('../../burnout-risk/services/burnoutRiskEvaluationService');

// DEV ONLY — remove or protect before production
router.post('/run-all', async (req, res, next) => {
  try {
    const { organizationId } = req.body || {};

    if (!organizationId || !mongoose.Types.ObjectId.isValid(organizationId)) {
      return res.status(400).json({ message: 'organizationId must be a valid ObjectId' });
    }

    const ranAt = new Date();

    const compliance = await evaluateRulesForOrganization({ organizationId });
    const productivity = await computePrTurnaroundTrend({ organizationId });
    const burnout = await evaluateBurnoutRisk({ organizationId });

    return res.json({
      organizationId,
      ranAt,
      compliance,
      productivity,
      burnout
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
