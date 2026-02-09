const router = require('express').Router();
const orgAnalyticsController = require('../controllers/orgAnalyticsController');

// Read-only analytics overview for an organization.
// Auth intentionally disabled for initial dashboard demo.
router.get('/org-overview', orgAnalyticsController.getOrgOverview);

module.exports = router;
