const express = require('express');
const { body } = require('express-validator');
const actionItemController = require('../controllers/actionItemController');
const { authenticate } = require('../middleware/auth');
const { enforceTenantIsolation } = require('../middleware/tenant');
const { validate } = require('../middleware/validate');

const router = express.Router();

router.use(authenticate, enforceTenantIsolation);

router.get('/', actionItemController.list);

router.post(
  '/',
  validate([
    body('title').optional().trim(),
    body('task').optional().trim(),
    body('priority').optional().isIn(['urgent', 'high', 'medium', 'low']),
  ]),
  actionItemController.create
);

router.patch(
  '/:id',
  validate([
    body('status').optional().isIn(['pending', 'in_progress', 'completed', 'dismissed']),
    body('priority').optional().isIn(['urgent', 'high', 'medium', 'low']),
    body('crmSyncStatus').optional().isIn(['not_synced', 'synced', 'failed']),
  ]),
  actionItemController.update
);

router.patch(
  '/:id/status',
  validate([
    body('status').optional().isIn(['pending', 'in_progress', 'completed', 'dismissed']),
    body('crmSyncStatus').optional().isIn(['not_synced', 'synced', 'failed']),
  ]),
  actionItemController.update
);

router.delete('/:id', actionItemController.remove);

module.exports = router;
