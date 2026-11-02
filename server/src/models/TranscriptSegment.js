const mongoose = require('mongoose');

const transcriptSegmentSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization ID is mandatory'],
      index: true,
    },
    meetingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Meeting',
      required: [true, 'Meeting ID is mandatory'],
      index: true,
    },
    segmentIndex: {
      type: Number,
      required: true,
      index: true,
    },
    startTime: {
      type: Number,
      default: 0, // In seconds
    },
    endTime: {
      type: Number,
      default: 0,
    },
    speaker: {
      type: String,
      default: 'Speaker',
      trim: true,
    },
    text: {
      type: String,
      required: [true, 'Transcript text is required'],
      trim: true,
    },
    confidence: {
      type: Number,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

transcriptSegmentSchema.index({ meetingId: 1, segmentIndex: 1 });
transcriptSegmentSchema.index({ organizationId: 1, meetingId: 1 });

module.exports = mongoose.model('TranscriptSegment', transcriptSegmentSchema);
