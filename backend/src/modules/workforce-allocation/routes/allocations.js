const router = require('express').Router();
const allocationController = require('../controllers/allocationController');
const { requireAuth, requireRole } = require('../../../middlewares/auth');

router.get('/suggestions', requireAuth, requireRole(['manager']), allocationController.getSuggestions);
router.post('/confirm', requireAuth, requireRole(['manager']), allocationController.confirmAssignment);
router.post('/:assignmentId/override', requireAuth, requireRole(['manager']), allocationController.overrideAssignment);

module.exports = router;
