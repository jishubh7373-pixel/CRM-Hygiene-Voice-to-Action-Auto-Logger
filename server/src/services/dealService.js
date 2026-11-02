const Deal = require('../models/Deal');
const ActionItem = require('../models/ActionItem');
const Meeting = require('../models/Meeting');
const MeetingInsight = require('../models/MeetingInsight');
const AppError = require('../utils/appError');
const { recordAudit } = require('./auditService');

/**
 * List deals scoped to tenant
 */
const listDeals = async ({ organizationId, stage, hygieneStatus, search, page = 1, limit = 20 }) => {
  const query = { organizationId };

  if (stage) query.stage = stage;
  if (hygieneStatus) query.hygieneStatus = hygieneStatus;
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { accountName: { $regex: search, $options: 'i' } },
    ];
  }

  const skip = (page - 1) * limit;

  const [deals, total] = await Promise.all([
    Deal.find(query)
      .populate('ownerId', 'name email')
      .sort({ closeDate: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Deal.countDocuments(query),
  ]);

  return {
    deals,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / limit),
    },
  };
};

/**
 * Get single deal with related action items
 */
const getDealById = async (organizationId, dealId) => {
  const deal = await Deal.findOne({ _id: dealId, organizationId }).populate('ownerId', 'name email');
  if (!deal) {
    throw new AppError('Deal opportunity not found or unauthorized.', 404, 'NOT_FOUND');
  }

  const actionItems = await ActionItem.find({ dealId, organizationId }).populate('assigneeId', 'name email');

  return {
    deal,
    actionItems,
  };
};

/**
 * Get comprehensive Deal Intelligence aggregating linked meeting insights
 */
const getDealIntelligence = async (organizationId, dealId) => {
  const deal = await Deal.findOne({ _id: dealId, organizationId }).populate('ownerId', 'name email').lean();
  if (!deal) {
    throw new AppError('Deal not found or unauthorized.', 404, 'NOT_FOUND');
  }

  // 1. Find all associated meetings
  const meetings = await Meeting.find({ dealId, organizationId })
    .sort({ meetingDate: -1, scheduledStartTime: -1 })
    .lean();

  const meetingIds = meetings.map((m) => m._id);

  // 2. Find insights across these meetings
  const insights = await MeetingInsight.find({
    meetingId: { $in: meetingIds },
    organizationId,
  })
    .sort({ createdAt: -1 })
    .lean();

  // 3. Outstanding action items
  const actionItems = await ActionItem.find({ dealId, organizationId })
    .sort({ dueDate: 1 })
    .populate('assigneeId', 'name email')
    .lean();

  // 4. Latest meeting summary
  const latestInsight = insights[0] || null;
  const latestSummary = latestInsight?.summary || null;

  // 5. Aggregate unique decision criteria, buying signals, objections, risks across all meetings
  const allDecisionCriteria = [];
  const allBuyingSignals = [];
  const allObjections = [];
  const allRisks = [];
  const allCompetitors = [];

  insights.forEach((ins) => {
    if (Array.isArray(ins.decisionCriteria)) allDecisionCriteria.push(...ins.decisionCriteria);
    if (Array.isArray(ins.buyingSignals)) allBuyingSignals.push(...ins.buyingSignals);
    if (Array.isArray(ins.objections)) allObjections.push(...ins.objections);
    if (Array.isArray(ins.risks)) allRisks.push(...ins.risks);
    if (Array.isArray(ins.competitors)) allCompetitors.push(...ins.competitors);
  });

  return {
    deal,
    meetings,
    latestSummary,
    dealHealth: latestInsight?.dealHealth || {
      totalScore: deal.hygieneScore || 75,
      dimensionScores: {
        requirementsClarity: 10,
        budgetClarity: 10,
        timelineClarity: 10,
        decisionMakerIdentified: 10,
        buyingSignals: 15,
        objectionResolution: 10,
        nextStepClarity: 10,
      },
      explanation: 'Initial deal baseline evaluation.',
      calculatedAt: deal.updatedAt,
    },
    decisionCriteria: allDecisionCriteria,
    buyingSignals: allBuyingSignals,
    objections: allObjections,
    risks: allRisks,
    competitors: allCompetitors,
    actionItems,
  };
};

/**
 * Create new deal
 */
const createDeal = async ({ organizationId, ownerId, data, userEmail }) => {
  let hygieneScore = 90;
  const riskReasons = [];
  const now = new Date();
  const closeDate = new Date(data.closeDate);

  if (closeDate < now) {
    hygieneScore -= 30;
    riskReasons.push('Close date is in the past');
  }

  const hygieneStatus = hygieneScore >= 75 ? 'healthy' : hygieneScore >= 50 ? 'at_risk' : 'stale';

  const deal = await Deal.create({
    organizationId,
    ownerId,
    ...data,
    hygieneScore,
    hygieneStatus,
    riskReasons,
  });

  await recordAudit({
    organizationId,
    userId: ownerId,
    userEmail,
    action: 'DEAL_CREATED',
    entityType: 'Deal',
    entityId: deal._id.toString(),
    details: { name: deal.name, amount: deal.amount, stage: deal.stage },
  });

  return deal;
};

/**
 * Update deal
 */
const updateDeal = async ({ organizationId, dealId, data, userId, userEmail }) => {
  const existing = await Deal.findOne({ _id: dealId, organizationId });
  if (!existing) {
    throw new AppError('Deal not found or unauthorized.', 404, 'NOT_FOUND');
  }

  const updatedData = { ...data };
  if (data.closeDate) {
    const closeDate = new Date(data.closeDate);
    const now = new Date();
    let score = existing.hygieneScore;
    const risks = [...(existing.riskReasons || [])];

    if (closeDate < now && !risks.includes('Close date is in the past')) {
      score = Math.max(0, score - 25);
      risks.push('Close date is in the past');
    } else if (closeDate >= now) {
      const idx = risks.indexOf('Close date is in the past');
      if (idx !== -1) risks.splice(idx, 1);
      score = Math.min(100, score + 15);
    }
    updatedData.hygieneScore = score;
    updatedData.hygieneStatus = score >= 75 ? 'healthy' : score >= 50 ? 'at_risk' : 'stale';
    updatedData.riskReasons = risks;
  }

  const deal = await Deal.findOneAndUpdate(
    { _id: dealId, organizationId },
    { $set: updatedData },
    { new: true, runValidators: true }
  ).populate('ownerId', 'name email');

  await recordAudit({
    organizationId,
    userId,
    userEmail,
    action: 'DEAL_UPDATED',
    entityType: 'Deal',
    entityId: dealId,
    details: data,
  });

  return deal;
};

module.exports = {
  listDeals,
  getDealById,
  getDealIntelligence,
  createDeal,
  updateDeal,
};
