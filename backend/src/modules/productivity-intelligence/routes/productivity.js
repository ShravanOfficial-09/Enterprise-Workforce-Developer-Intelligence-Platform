const router = require('express').Router();
const productivityController = require('../controllers/productivityController');
const { requireAuth, requireRole } = require('../../../middlewares/auth');

// Read-only endpoints for metrics and signals.
router.get('/metrics', requireAuth, requireRole(['manager']), productivityController.listMetrics);
router.get('/signals', requireAuth, requireRole(['manager']), productivityController.listSignals);

module.exports = router;
