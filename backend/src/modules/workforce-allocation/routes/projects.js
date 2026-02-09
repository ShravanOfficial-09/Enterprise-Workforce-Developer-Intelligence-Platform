const router = require('express').Router();
const projectController = require('../controllers/projectController');
const { requireAuth, requireRole } = require('../../../middlewares/auth');

router.get('/', requireAuth, requireRole(['manager']), projectController.list);
router.post('/', requireAuth, requireRole(['manager']), projectController.create);
router.get('/:id', requireAuth, requireRole(['manager']), projectController.getById);
router.patch('/:id', requireAuth, requireRole(['manager']), projectController.update);
router.delete('/:id', requireAuth, requireRole(['manager']), projectController.remove);

module.exports = router;
