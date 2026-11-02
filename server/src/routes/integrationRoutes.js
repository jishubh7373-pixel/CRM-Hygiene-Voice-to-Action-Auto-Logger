const express = require('express');
const { body, query } = require('express-validator');
const integrationController = require('../controllers/integrationController');
const { authenticate } = require('../middleware/auth');
const { enforceTenantIsolation } = require('../middleware/tenant');
const { authorize } = require('../middleware/role');
const { validate } = require('../middleware/validate');

const router = express.Router();

router.use(authenticate, enforceTenantIsolation);

// List all integrations
router.get('/', integrationController.list);

// Single provider status
router.get('/:provider/status', integrationController.getStatus);

// OAuth authorization URL initiation
router.get('/:provider/auth-url', integrationController.getAuthUrl);

// OAuth code exchange callback
router.post(
  '/:provider/callback',
  validate([
    body('code').notEmpty().withMessage('Authorization code is required'),
    body('state').notEmpty().withMessage('OAuth state is required'),
  ]),
  integrationController.oauthCallback
);

// Disconnect provider
router.post('/:provider/disconnect', authorize('admin'), integrationController.disconnect);

// Test provider connection
router.post('/:provider/test', integrationController.testConnection);

// Gong specific endpoints
router.post(
  '/gong/configure',
  authorize('admin'),
  validate([
    body('accessKey').notEmpty().withMessage('Gong Access Key is required'),
    body('clientSecret').notEmpty().withMessage('Gong Client Secret is required'),
  ]),
  integrationController.configureGong
);

router.post('/gong/import', integrationController.importGong);

// HubSpot specific endpoints
router.post('/hubspot/sync', integrationController.syncHubspot);
router.get('/hubspot/deals', integrationController.getHubspotDeals);
router.get('/hubspot/pipelines', integrationController.getHubspotPipelines);

// Jira specific endpoints
router.get('/jira/sites', integrationController.getJiraSites);
router.get('/jira/projects', integrationController.getJiraProjects);
router.post(
  '/jira/configure',
  authorize('admin'),
  validate([
    body('cloudId').notEmpty().withMessage('Jira Cloud ID is required'),
    body('projectKey').notEmpty().withMessage('Project key is required'),
  ]),
  integrationController.configureJira
);
router.post('/jira/test-issue', integrationController.testJiraIssue);

// Zoom specific endpoints
router.post('/zoom/configure', authorize('admin'), integrationController.configureZoom);

// Backward compatibility endpoints
router.post('/configure', authorize('admin'), integrationController.configure);
router.post('/disconnect', authorize('admin'), integrationController.disconnect);

module.exports = router;
