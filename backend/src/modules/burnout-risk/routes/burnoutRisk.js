const router = require('express').Router();
const burnoutRiskController = require('../controllers/burnoutRiskController');
const { requireAuth, requireRole } = require('../../../middlewares/auth');

// Read-only endpoints for burnout risk rules and signals.
router.get('/signals', requireAuth, requireRole(['manager']), burnoutRiskController.listSignals);
router.get('/rules', requireAuth, requireRole(['manager']), burnoutRiskController.listRules);

module.exports = router;
