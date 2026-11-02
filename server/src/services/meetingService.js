const Meeting = require('../models/Meeting');
const Deal = require('../models/Deal');
const TranscriptSegment = require('../models/TranscriptSegment');
const MeetingInsight = require('../models/MeetingInsight');
const ActionItem = require('../models/ActionItem');
const storageService = require('../modules/storage/storage.service');
const transcriptionService = require('../modules/transcription/transcription.service');
const aiService = require('../modules/ai/ai.service');
const AppError = require('../utils/appError');
const { addMeetingJob } = require('../queues/meetingQueue');
const { recordAudit } = require('./auditService');
const { emitToOrganization } = require('../socket/socketServer');

/**
 * List meetings scoped to the organization
 */
const listMeetings = async ({
  organizationId,
  status,
  processingStatus,
  platform,
  source,
  dealId,
  search,
  page = 1,
  limit = 20,
}) => {
  const query = { organizationId };

  if (status) query.status = status;
  if (processingStatus) query.processingStatus = processingStatus;
  if (platform) query.platform = platform;
  if (source) query.source = source;
  if (dealId) query.dealId = dealId;
  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { clientName: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
    ];
  }

  const skip = (page - 1) * limit;

  const [meetings, total] = await Promise.all([
    Meeting.find(query)
      .populate('hostId', 'name email role')
      .populate('uploadedBy', 'name email role')
      .populate('dealId', 'name stage amount hygieneScore')
      .sort({ meetingDate: -1, scheduledStartTime: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Meeting.countDocuments(query),
  ]);

  return {
    meetings,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / limit),
    },
  };
};

/**
 * Get meeting by ID with tenant isolation
 */
const getMeetingById = async (organizationId, meetingId) => {
  const meeting = await Meeting.findOne({ _id: meetingId, organizationId })
    .populate('hostId', 'name email role')
    .populate('uploadedBy', 'name email role')
    .populate('dealId', 'name accountName stage amount hygieneScore hygieneStatus');

  if (!meeting) {
    throw new AppError('Meeting record not found or unauthorized.', 404, 'NOT_FOUND');
  }

  return meeting;
};

/**
 * Upload Audio and Initiate End-to-End Meeting Pipeline
 */
const uploadAndCreateMeeting = async ({
  organizationId,
  userId,
  userEmail,
  file,
  title,
  description,
  meetingDate,
  dealId,
  clientName,
  clientEmail,
  ipAddress,
}) => {
  if (!file || !file.buffer) {
    throw new AppError('No audio file uploaded or invalid file payload.', 400, 'FILE_MISSING');
  }

  // 1. Validate file constraints
  storageService.validateAudioFile(file);

  // 2. Create initial Meeting document
  const meeting = await Meeting.create({
    organizationId,
    uploadedBy: userId,
    hostId: userId,
    title: title || file.originalname.replace(/\.[^/.]+$/, ''),
    description: description || '',
    meetingDate: meetingDate ? new Date(meetingDate) : new Date(),
    scheduledStartTime: meetingDate ? new Date(meetingDate) : new Date(),
    source: 'audio_upload',
    platform: 'audio_upload',
    dealId: dealId || null,
    clientName: clientName || 'Client Account',
    clientEmail: clientEmail || '',
    processingStatus: 'uploading',
    transcriptionStatus: 'pending',
    analysisStatus: 'pending',
    status: 'processing',
    audioStorage: {
      stored: false,
      originalName: file.originalname,
      originalFileName: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      fileSize: file.size,
    },
  });

  // 3. Store audio safely via Storage Provider
  const storageResult = await storageService.storeAudio({
    buffer: file.buffer,
    originalName: file.originalname,
    mimeType: file.mimetype,
    organizationId,
    meetingId: meeting._id.toString(),
  });

  // 4. Update meeting with storage key
  meeting.audioStorage.stored = true;
  meeting.audioStorage.key = storageResult.key;
  meeting.audioStorage.storageKey = storageResult.key;
  meeting.audioStorage.provider = storageResult.provider;
  meeting.audioStorage.storageProvider = storageResult.provider;
  meeting.audioStorage.localPath = storageResult.localPath || '';
  meeting.processingStatus = 'pending';
  await meeting.save();

  // 5. Emit real-time notification
  emitToOrganization(organizationId, 'meeting:created', {
    meetingId: meeting._id.toString(),
    title: meeting.title,
    processingStatus: 'pending',
  });

  // 6. Enqueue background processing job
  await addMeetingJob('meeting-upload-processing', {
    meetingId: meeting._id.toString(),
    organizationId: organizationId.toString(),
    storageKey: storageResult.key,
    filename: file.originalname,
    mimeType: file.mimetype,
  });

  // 7. Audit log
  await recordAudit({
    organizationId,
    userId,
    userEmail,
    action: 'MEETING_AUDIO_UPLOADED',
    entityType: 'Meeting',
    entityId: meeting._id.toString(),
    details: {
      filename: file.originalname,
      sizeBytes: file.size,
      storageKey: storageResult.key,
    },
    ipAddress,
  });

  return meeting;
};

/**
 * Get Audio Stream for authenticated playback
 */
const getMeetingAudioStream = async (organizationId, meetingId) => {
  const meeting = await Meeting.findOne({ _id: meetingId, organizationId });
  if (!meeting || !meeting.audioStorage?.key) {
    throw new AppError('Audio record not found or unauthorized.', 404, 'AUDIO_NOT_FOUND');
  }

  const stream = await storageService.getAudioStream(meeting.audioStorage.key);
  return {
    stream,
    mimeType: meeting.audioStorage.mimeType || 'audio/mpeg',
    sizeBytes: meeting.audioStorage.sizeBytes || 0,
    filename: meeting.audioStorage.originalName || 'audio.mp3',
  };
};

/**
 * Reprocess meeting from existing audio
 */
const reprocessMeeting = async ({ organizationId, meetingId, userId, userEmail }) => {
  const meeting = await Meeting.findOne({ _id: meetingId, organizationId });
  if (!meeting) {
    throw new AppError('Meeting not found or unauthorized.', 404, 'NOT_FOUND');
  }

  if (!meeting.audioStorage?.key) {
    throw new AppError('No stored audio found to reprocess.', 400, 'AUDIO_NOT_FOUND');
  }

  meeting.processingStatus = 'pending';
  meeting.transcriptionStatus = 'pending';
  meeting.analysisStatus = 'pending';
  meeting.errorDetails = null;
  await meeting.save();

  await addMeetingJob('meeting-upload-processing', {
    meetingId: meeting._id.toString(),
    organizationId: organizationId.toString(),
    storageKey: meeting.audioStorage.key,
    filename: meeting.audioStorage.originalName || 'audio.mp3',
    mimeType: meeting.audioStorage.mimeType || 'audio/mpeg',
  });

  await recordAudit({
    organizationId,
    userId,
    userEmail,
    action: 'MEETING_REPROCESSED',
    entityType: 'Meeting',
    entityId: meetingId,
  });

  return meeting;
};

/**
 * Create meeting manually (Phase 1 compatibility)
 */
const createMeeting = async ({ organizationId, hostId, data, userEmail, ipAddress }) => {
  const meeting = await Meeting.create({
    organizationId,
    hostId,
    uploadedBy: hostId,
    ...data,
  });

  // If meeting was linked to a deal, update deal's last activity
  if (meeting.dealId) {
    await Deal.findOneAndUpdate({ _id: meeting.dealId, organizationId }, { lastActivityDate: new Date() });
  }

  await recordAudit({
    organizationId,
    userId: hostId,
    userEmail,
    action: 'MEETING_CREATED',
    entityType: 'Meeting',
    entityId: meeting._id.toString(),
    details: { title: meeting.title, clientName: meeting.clientName },
    ipAddress,
  });

  return meeting;
};

/**
 * Update meeting
 */
const updateMeeting = async ({ organizationId, meetingId, updateData, userId, userEmail }) => {
  const meeting = await Meeting.findOneAndUpdate(
    { _id: meetingId, organizationId },
    { $set: updateData },
    { new: true, runValidators: true }
  );

  if (!meeting) {
    throw new AppError('Meeting not found or unauthorized.', 404, 'NOT_FOUND');
  }

  await recordAudit({
    organizationId,
    userId,
    userEmail,
    action: 'MEETING_UPDATED',
    entityType: 'Meeting',
    entityId: meetingId,
    details: updateData,
  });

  return meeting;
};

/**
 * Delete meeting and all associated artifacts
 */
const deleteMeeting = async ({ organizationId, meetingId, userId, userEmail }) => {
  const meeting = await Meeting.findOne({ _id: meetingId, organizationId });

  if (!meeting) {
    throw new AppError('Meeting not found or unauthorized.', 404, 'NOT_FOUND');
  }

  // 1. Delete stored audio file if present
  if (meeting.audioStorage?.key) {
    await storageService.deleteAudio(meeting.audioStorage.key);
  }

  // 2. Delete transcript segments
  await TranscriptSegment.deleteMany({ meetingId, organizationId });

  // 3. Delete meeting insights
  await MeetingInsight.deleteMany({ meetingId, organizationId });

  // 4. Delete action items linked to meeting
  await ActionItem.deleteMany({ meetingId, organizationId });

  // 5. Delete meeting document
  await Meeting.deleteOne({ _id: meetingId, organizationId });

  await recordAudit({
    organizationId,
    userId,
    userEmail,
    action: 'MEETING_DELETED',
    entityType: 'Meeting',
    entityId: meetingId,
  });

  return true;
};

/**
 * Confirm direct-to-cloud (S3) upload and enqueue meeting processing
 */
const confirmDirectCloudUpload = async ({
  organizationId,
  userId,
  userEmail,
  title,
  description,
  meetingDate,
  dealId,
  clientName,
  clientEmail,
  storageKey,
  originalName,
  mimeType,
  fileSize,
  ipAddress,
}) => {
  if (!storageKey) {
    throw new AppError('Storage key is required to confirm direct upload.', 400, 'KEY_REQUIRED');
  }

  // Security check: ensure storage key belongs to tenant prefix
  if (!storageKey.startsWith(`audio/${organizationId}/`)) {
    throw new AppError('Invalid storage key or tenant boundary violation.', 403, 'FORBIDDEN_KEY');
  }

  const meeting = await Meeting.create({
    organizationId,
    uploadedBy: userId,
    hostId: userId,
    title: title || (originalName ? originalName.replace(/\.[^/.]+$/, '') : 'Direct Cloud Meeting'),
    description: description || '',
    meetingDate: meetingDate ? new Date(meetingDate) : new Date(),
    scheduledStartTime: meetingDate ? new Date(meetingDate) : new Date(),
    source: 'audio_upload',
    platform: 'audio_upload',
    dealId: dealId || null,
    clientName: clientName || 'Client Account',
    clientEmail: clientEmail || '',
    processingStatus: 'pending',
    transcriptionStatus: 'pending',
    analysisStatus: 'pending',
    status: 'processing',
    audioStorage: {
      stored: true,
      key: storageKey,
      storageKey: storageKey,
      provider: 's3',
      storageProvider: 's3',
      originalName: originalName || 'uploaded_recording.mp3',
      originalFileName: originalName || 'uploaded_recording.mp3',
      mimeType: mimeType || 'audio/mpeg',
      sizeBytes: fileSize || 0,
      fileSize: fileSize || 0,
    },
  });

  emitToOrganization(organizationId, 'meeting:created', {
    meetingId: meeting._id.toString(),
    title: meeting.title,
    processingStatus: 'pending',
  });

  await addMeetingJob('meeting-upload-processing', {
    meetingId: meeting._id.toString(),
    organizationId: organizationId.toString(),
    storageKey,
    filename: originalName || 'recording.mp3',
    mimeType: mimeType || 'audio/mpeg',
  });

  await recordAudit({
    organizationId,
    userId,
    userEmail,
    action: 'MEETING_AUDIO_UPLOADED_DIRECT_S3',
    entityType: 'Meeting',
    entityId: meeting._id.toString(),
    details: {
      storageKey,
      filename: originalName,
      sizeBytes: fileSize,
      ipAddress,
    },
  });

  return meeting;
};

module.exports = {
  listMeetings,
  getMeetingById,
  uploadAndCreateMeeting,
  confirmDirectCloudUpload,
  getMeetingAudioStream,
  reprocessMeeting,
  createMeeting,
  updateMeeting,
  deleteMeeting,
};
