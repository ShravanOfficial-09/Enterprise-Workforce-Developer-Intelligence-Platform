const router = require('express').Router();
const employeeController = require('../controllers/employeeController');
const { requireAuth, requireRole } = require('../../../middlewares/auth');

router.get('/', requireAuth, requireRole(['manager']), employeeController.list);
router.post('/', requireAuth, requireRole(['manager']), employeeController.create);
router.get('/:id', requireAuth, requireRole(['manager']), employeeController.getById);
router.patch('/:id', requireAuth, requireRole(['manager']), employeeController.update);
router.delete('/:id', requireAuth, requireRole(['manager']), employeeController.remove);

module.exports = router;
