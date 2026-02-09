const router = require('express').Router();
const complianceController = require('../controllers/complianceController');
const { requireAuth, requireRole } = require('../../../middlewares/auth');

// Read-only endpoints for compliance signals and audit logs.
router.get('/signals', requireAuth, requireRole(['manager']), complianceController.listSignals);
router.get('/audit-logs', requireAuth, requireRole(['manager']), complianceController.listAuditLogs);

module.exports = router;
