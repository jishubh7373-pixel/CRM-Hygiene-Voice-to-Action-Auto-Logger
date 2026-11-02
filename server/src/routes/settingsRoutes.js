const express = require('express');
const { body } = require('express-validator');
const settingsController = require('../controllers/settingsController');
const { authenticate } = require('../middleware/auth');
const { enforceTenantIsolation } = require('../middleware/tenant');
const { authorize } = require('../middleware/role');
const { validate } = require('../middleware/validate');

const router = express.Router();

router.use(authenticate, enforceTenantIsolation);

router.get('/organization', settingsController.getOrgSettings);

router.patch('/organization', authorize('admin'), settingsController.updateOrgSettings);

router.get('/team', settingsController.listTeam);

router.post(
  '/team/invite',
  authorize('admin'),
  validate([
    body('name').trim().notEmpty().withMessage('User name is required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('role').optional().isIn(['admin', 'manager', 'rep']),
  ]),
  settingsController.inviteMember
);

router.get('/audit-logs', authorize('admin'), settingsController.listAuditLogs);
router.get('/usage', settingsController.getAiUsage);
router.get('/data-retention', authorize('admin'), settingsController.getDataRetention);
router.patch('/data-retention', authorize('admin'), settingsController.updateDataRetention);
router.post('/data-export', authorize('admin'), settingsController.exportData);
router.post('/purge-audio', authorize('admin'), settingsController.purgeAudio);

module.exports = router;

