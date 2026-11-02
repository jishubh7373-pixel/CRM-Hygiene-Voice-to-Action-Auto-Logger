const express = require('express');
const { body, param, query } = require('express-validator');
const automationController = require('./automation.controller');
const { authenticate } = require('../../middleware/auth');
const { enforceTenantIsolation } = require('../../middleware/tenant');
const { authorize } = require('../../middleware/role');
const { validate } = require('../../middleware/validate');

const router = express.Router();

router.use(authenticate, enforceTenantIsolation);

// Actions listing & querying
router.get('/actions', automationController.listActions);
router.get('/actions/:actionId', automationController.getActionById);

// Propose actions manually or trigger post-meeting
router.post(
  '/actions/generate',
  validate([body('meetingId').notEmpty().withMessage('Meeting ID is required')]),
  automationController.generateActions
);

// Edit proposed action payload
router.patch('/actions/:actionId', automationController.editAction);

// Approve action (Admin and Manager only)
router.post('/actions/:actionId/approve', authorize('admin', 'manager'), automationController.approveAction);

// Reject action (Admin and Manager only)
router.post('/actions/:actionId/reject', authorize('admin', 'manager'), automationController.rejectAction);

// Cancel action
router.post('/actions/:actionId/cancel', automationController.cancelAction);

// Execute approved action (Admin and Manager only - MUST BE APPROVED)
router.post('/actions/:actionId/execute', authorize('admin', 'manager'), automationController.executeAction);

// Retry failed action
router.post('/actions/:actionId/retry', authorize('admin', 'manager'), automationController.retryAction);

// Action audit history timeline
router.get('/actions/:actionId/history', automationController.getActionHistory);

// Execution attempts logs
router.get('/executions', automationController.listExecutions);

// Automation settings
router.get('/settings', automationController.getSettings);
router.patch('/settings', authorize('admin'), automationController.updateSettings);

module.exports = router;
