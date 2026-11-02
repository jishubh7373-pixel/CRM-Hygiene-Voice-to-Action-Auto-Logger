const express = require('express');
const dashboardController = require('../controllers/dashboardController');
const { authenticate } = require('../middleware/auth');
const { enforceTenantIsolation } = require('../middleware/tenant');

const router = express.Router();

router.use(authenticate, enforceTenantIsolation);

router.get('/summary', dashboardController.getSummary);

module.exports = router;
