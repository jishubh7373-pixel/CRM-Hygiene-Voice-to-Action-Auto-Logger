const Deal = require('../models/Deal');
const Meeting = require('../models/Meeting');
const ActionItem = require('../models/ActionItem');
const ApiResponse = require('../utils/apiResponse');

const getSummary = async (req, res, next) => {
  try {
    const organizationId = req.organizationId;

    const [deals, meetings, pendingActionsCount, recentMeetings, dealsAtRisk] = await Promise.all([
      Deal.find({ organizationId }).lean(),
      Meeting.find({ organizationId }).lean(),
      ActionItem.countDocuments({ organizationId, status: { $in: ['pending', 'in_progress'] } }),
      Meeting.find({ organizationId })
        .sort({ scheduledStartTime: -1 })
        .limit(5)
        .populate('hostId', 'name email')
        .populate('dealId', 'name stage amount')
        .lean(),
      Deal.find({ organizationId, hygieneStatus: { $in: ['at_risk', 'stale'] } })
        .sort({ closeDate: 1 })
        .limit(5)
        .populate('ownerId', 'name')
        .lean(),
    ]);

    // Calculate pipeline value
    const totalPipelineValue = deals.reduce((sum, d) => sum + (d.amount || 0), 0);

    // Calculate weighted hygiene score
    const avgHygieneScore =
      deals.length > 0 ? Math.round(deals.reduce((sum, d) => sum + (d.hygieneScore || 0), 0) / deals.length) : 100;

    // Pipeline by stage
    const stageCounts = {
      discovery: 0,
      qualification: 0,
      demo: 0,
      proposal: 0,
      negotiation: 0,
      closed_won: 0,
      closed_lost: 0,
    };

    const stageValues = {
      discovery: 0,
      qualification: 0,
      demo: 0,
      proposal: 0,
      negotiation: 0,
      closed_won: 0,
      closed_lost: 0,
    };

    deals.forEach((d) => {
      if (stageCounts[d.stage] !== undefined) {
        stageCounts[d.stage] += 1;
        stageValues[d.stage] += d.amount || 0;
      }
    });

    const hygieneBreakdown = {
      healthy: deals.filter((d) => d.hygieneStatus === 'healthy').length,
      at_risk: deals.filter((d) => d.hygieneStatus === 'at_risk').length,
      stale: deals.filter((d) => d.hygieneStatus === 'stale').length,
    };

    return ApiResponse.success(res, {
      metrics: {
        totalPipelineValue,
        avgHygieneScore,
        totalDeals: deals.length,
        totalMeetings: meetings.length,
        pendingActionsCount,
      },
      stageCounts,
      stageValues,
      hygieneBreakdown,
      dealsAtRisk,
      recentMeetings,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSummary,
};
