const express = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();

router.post(
  '/register',
  validate([
    body('orgName').trim().notEmpty().withMessage('Organization name is required'),
    body('domain').trim().notEmpty().withMessage('Domain is required'),
    body('adminName').trim().notEmpty().withMessage('Admin full name is required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long'),
  ]),
  authController.register
);

router.post(
  '/login',
  validate([
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ]),
  authController.login
);

router.post(
  '/refresh-token',
  validate([body('refreshToken').notEmpty().withMessage('Refresh token is required')]),
  authController.refresh
);

router.post('/logout', authenticate, authController.logout);

router.get('/me', authenticate, authController.getMe);

router.post(
  '/forgot-password',
  validate([
    body('email').isEmail().normalizeEmail().withMessage('Valid email address is required'),
  ]),
  authController.forgotPassword
);

router.post(
  '/reset-password',
  validate([
    body('token').notEmpty().withMessage('Reset token is required'),
    body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters long'),
  ]),
  authController.resetPassword
);

module.exports = router;
