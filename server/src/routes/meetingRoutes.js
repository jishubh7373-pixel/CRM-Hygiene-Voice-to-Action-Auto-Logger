const express = require('express');
const multer = require('multer');
const { body } = require('express-validator');
const meetingController = require('../controllers/meetingController');
const { authenticate } = require('../middleware/auth');
const { enforceTenantIsolation } = require('../middleware/tenant');
const { authorize } = require('../middleware/role');
const { validate } = require('../middleware/validate');
const config = require('../config');
const AppError = require('../utils/appError');

const router = express.Router();

// Memory storage multer config
const uploadMulter = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: (config.storage?.maxAudioUploadMb || 25) * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'audio/mpeg',
      'audio/mp3',
      'audio/wav',
      'audio/wave',
      'audio/x-wav',
      'audio/m4a',
      'audio/x-m4a',
      'audio/mp4',
      'video/mp4',
    ];
    if (allowedMimes.includes(file.mimetype.toLowerCase()) || file.originalname.match(/\.(mp3|wav|m4a|mp4)$/i)) {
      cb(null, true);
    } else {
      cb(new AppError(`Unsupported audio file type: ${file.mimetype}`, 400, 'UNSUPPORTED_MEDIA_TYPE'), false);
    }
  },
});

router.use(authenticate, enforceTenantIsolation);

// Meetings list
router.get('/', meetingController.list);

// Upload audio meeting
router.post(
  '/upload',
  uploadMulter.single('audio'),
  validate([
    body('title').optional().trim(),
    body('meetingDate').optional().isISO8601(),
    body('dealId').optional().isMongoId(),
  ]),
  meetingController.upload
);

// Presigned S3 upload URL for large files (> 25MB)
router.post(
  '/upload-url',
  validate([
    body('fileName').notEmpty().withMessage('fileName is required'),
    body('mimeType').notEmpty().withMessage('mimeType is required'),
    body('fileSize').isNumeric().withMessage('fileSize must be a number'),
  ]),
  meetingController.getUploadUrl
);

// Confirm direct S3 upload completion
router.post(
  '/confirm-upload',
  validate([
    body('storageKey').notEmpty().withMessage('storageKey is required'),
    body('title').trim().notEmpty().withMessage('Meeting title is required'),
    body('clientName').optional().trim(),
    body('fileSize').isNumeric().withMessage('fileSize is required'),
  ]),
  meetingController.confirmUpload
);

// Manual meeting creation (Phase 1 backwards compatibility)
router.post(
  '/',
  validate([
    body('title').trim().notEmpty().withMessage('Meeting title is required'),
    body('clientName').optional().trim(),
    body('platform').optional(),
    body('durationMinutes').optional().isNumeric(),
  ]),
  meetingController.create
);

// Audio stream
router.get('/:id/audio', meetingController.streamAudio);

// Transcript segments
router.get('/:id/transcript', meetingController.getTranscript);

// Meeting intelligence insights
router.get('/:id/insights', meetingController.getInsights);

// Human review & updates to insights
router.patch('/:id/insights', meetingController.updateInsights);

// Reprocess meeting
router.post('/:id/reprocess', meetingController.reprocess);

// Single meeting details
router.get('/:id', meetingController.getById);

// Update meeting
router.patch('/:id', meetingController.update);

// Delete meeting
router.delete('/:id', authorize('admin', 'manager'), meetingController.remove);

module.exports = router;
