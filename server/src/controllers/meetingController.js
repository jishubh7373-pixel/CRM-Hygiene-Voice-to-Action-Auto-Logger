const meetingService = require('../services/meetingService');
const transcriptionService = require('../modules/transcription/transcription.service');
const aiService = require('../modules/ai/ai.service');
const storageService = require('../modules/storage/storage.service');
const ApiResponse = require('../utils/apiResponse');

const list = async (req, res, next) => {
  try {
    const { status, processingStatus, platform, source, dealId, search, page, limit } = req.query;
    const result = await meetingService.listMeetings({
      organizationId: req.organizationId,
      status,
      processingStatus,
      platform,
      source,
      dealId,
      search,
      page,
      limit,
    });
    return ApiResponse.success(res, result);
  } catch (error) {
    next(error);
  }
};

const getById = async (req, res, next) => {
  try {
    const meeting = await meetingService.getMeetingById(req.organizationId, req.params.id);
    return ApiResponse.success(res, meeting);
  } catch (error) {
    next(error);
  }
};

const upload = async (req, res, next) => {
  try {
    const { title, description, meetingDate, dealId, clientName, clientEmail } = req.body;
    const meeting = await meetingService.uploadAndCreateMeeting({
      organizationId: req.organizationId,
      userId: req.user._id,
      userEmail: req.user.email,
      file: req.file,
      title,
      description,
      meetingDate,
      dealId,
      clientName,
      clientEmail,
      ipAddress: req.ip,
    });

    return ApiResponse.created(
      res,
      {
        meetingId: meeting._id,
        title: meeting.title,
        processingStatus: meeting.processingStatus,
        meeting,
      },
      'Audio uploaded successfully. Background transcription and AI intelligence pipeline initiated.'
    );
  } catch (error) {
    next(error);
  }
};

const streamAudio = async (req, res, next) => {
  try {
    const { stream, mimeType, sizeBytes, filename } = await meetingService.getMeetingAudioStream(
      req.organizationId,
      req.params.id
    );

    res.setHeader('Content-Type', mimeType);
    if (sizeBytes > 0) {
      res.setHeader('Content-Length', sizeBytes);
    }
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Accept-Ranges', 'bytes');

    stream.pipe(res);
  } catch (error) {
    next(error);
  }
};

const getTranscript = async (req, res, next) => {
  try {
    const segments = await transcriptionService.getMeetingTranscript(req.params.id, req.organizationId);
    return ApiResponse.success(res, segments, 'Transcript retrieved successfully.');
  } catch (error) {
    next(error);
  }
};

const getInsights = async (req, res, next) => {
  try {
    const insights = await aiService.getMeetingInsights(req.params.id, req.organizationId);
    return ApiResponse.success(res, insights, 'Meeting insights retrieved successfully.');
  } catch (error) {
    next(error);
  }
};

const updateInsights = async (req, res, next) => {
  try {
    const updated = await aiService.updateMeetingInsights({
      meetingId: req.params.id,
      organizationId: req.organizationId,
      updateData: req.body,
      userId: req.user._id,
    });
    return ApiResponse.success(res, updated, 'Meeting intelligence findings updated successfully.');
  } catch (error) {
    next(error);
  }
};

const reprocess = async (req, res, next) => {
  try {
    const meeting = await meetingService.reprocessMeeting({
      organizationId: req.organizationId,
      meetingId: req.params.id,
      userId: req.user._id,
      userEmail: req.user.email,
    });
    return ApiResponse.success(res, meeting, 'Meeting queued for re-processing.');
  } catch (error) {
    next(error);
  }
};

const create = async (req, res, next) => {
  try {
    const meeting = await meetingService.createMeeting({
      organizationId: req.organizationId,
      hostId: req.user._id,
      data: req.body,
      userEmail: req.user.email,
      ipAddress: req.ip,
    });
    return ApiResponse.created(res, meeting, 'Meeting logged and enqueued for transcription analysis.');
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const meeting = await meetingService.updateMeeting({
      organizationId: req.organizationId,
      meetingId: req.params.id,
      updateData: req.body,
      userId: req.user._id,
      userEmail: req.user.email,
    });
    return ApiResponse.success(res, meeting, 'Meeting updated successfully.');
  } catch (error) {
    next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    await meetingService.deleteMeeting({
      organizationId: req.organizationId,
      meetingId: req.params.id,
      userId: req.user._id,
      userEmail: req.user.email,
    });
    return ApiResponse.success(res, null, 'Meeting and associated audio/intelligence deleted successfully.');
  } catch (error) {
    next(error);
  }
};

const getUploadUrl = async (req, res, next) => {
  try {
    const { fileName, mimeType, fileSize } = req.body;
    const result = await storageService.getUploadUrl({
      organizationId: req.organizationId,
      originalName: fileName,
      mimeType,
      fileSize: Number(fileSize),
    });

    return ApiResponse.success(res, result, 'Upload URL generated successfully.');
  } catch (error) {
    next(error);
  }
};

const confirmUpload = async (req, res, next) => {
  try {
    const {
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
    } = req.body;

    const meeting = await meetingService.confirmDirectCloudUpload({
      organizationId: req.organizationId,
      userId: req.user._id,
      userEmail: req.user.email,
      title,
      description,
      meetingDate,
      dealId,
      clientName,
      clientEmail,
      storageKey,
      originalName,
      mimeType,
      fileSize: Number(fileSize),
      ipAddress: req.ip,
    });

    return ApiResponse.created(
      res,
      {
        meetingId: meeting._id,
        title: meeting.title,
        processingStatus: meeting.processingStatus,
        meeting,
      },
      'Direct cloud upload confirmed and background intelligence pipeline queued.'
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  list,
  getById,
  upload,
  getUploadUrl,
  confirmUpload,
  streamAudio,
  getTranscript,
  getInsights,
  updateInsights,
  reprocess,
  create,
  update,
  remove,
};
