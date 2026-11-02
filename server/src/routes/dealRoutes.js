const express = require('express');
const { body } = require('express-validator');
const dealController = require('../controllers/dealController');
const { authenticate } = require('../middleware/auth');
const { enforceTenantIsolation } = require('../middleware/tenant');
const { validate } = require('../middleware/validate');

const router = express.Router();

router.use(authenticate, enforceTenantIsolation);

router.get('/', dealController.list);

router.post(
  '/',
  validate([
    body('name').trim().notEmpty().withMessage('Deal opportunity name is required'),
    body('accountName').trim().notEmpty().withMessage('Account/Client name is required'),
    body('amount').isNumeric().withMessage('Amount must be a numeric value'),
    body('closeDate').isISO8601().withMessage('Valid close date is required'),
    body('stage')
      .optional()
      .isIn(['discovery', 'qualification', 'demo', 'proposal', 'negotiation', 'closed_won', 'closed_lost']),
  ]),
  dealController.create
);

router.get('/:id', dealController.getById);

router.get('/:id/intelligence', dealController.getIntelligence);

router.patch('/:id', dealController.update);

module.exports = router;
