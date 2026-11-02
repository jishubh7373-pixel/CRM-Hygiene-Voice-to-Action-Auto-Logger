/**
 * Explainable Deal Health Scoring Service
 * Evaluates internal deal health across 7 explicit dimensions (0 - 100 points).
 */

class DealHealthService {
  calculateHealthScore(analysisData = {}) {
    const {
      decisionCriteria = [],
      buyingSignals = [],
      objections = [],
      summary = {},
      actionItems = [],
    } = analysisData;

    const dimensions = {
      requirementsClarity: 0, // Max 15
      budgetClarity: 0, // Max 15
      timelineClarity: 0, // Max 15
      decisionMakerIdentified: 0, // Max 15
      buyingSignals: 0, // Max 20
      objectionResolution: 0, // Max 10
      nextStepClarity: 0, // Max 10
    };

    const explanations = [];

    // 1. Requirements Clarity (Max 15 pts)
    const techReqs = decisionCriteria.filter((c) =>
      ['feature', 'technical', 'security', 'integration'].includes(c.category)
    );
    if (techReqs.length >= 3) {
      dimensions.requirementsClarity = 15;
      explanations.push('Comprehensive technical & feature requirements documented (15/15 pts).');
    } else if (techReqs.length >= 1) {
      dimensions.requirementsClarity = 9;
      explanations.push(`Partial requirements documented: ${techReqs.length} criterion found (9/15 pts).`);
    } else {
      dimensions.requirementsClarity = 0;
      explanations.push('No concrete feature or technical criteria identified (0/15 pts).');
    }

    // 2. Budget Clarity (Max 15 pts)
    const budgetReqs = decisionCriteria.filter((c) => c.category === 'budget');
    const budgetSignals = buyingSignals.filter((s) => s.category === 'pricing');
    if (budgetReqs.length > 0 || budgetSignals.length > 0) {
      dimensions.budgetClarity = 15;
      explanations.push('Budget parameters or pricing structure explicitly addressed (15/15 pts).');
    } else {
      dimensions.budgetClarity = 0;
      explanations.push('Budget allocation and pricing terms remain unconfirmed (0/15 pts).');
    }

    // 3. Timeline Clarity (Max 15 pts)
    const timelineReqs = decisionCriteria.filter((c) => c.category === 'timeline');
    const timelineSignals = buyingSignals.filter((s) => s.category === 'timeline');
    if (timelineReqs.length > 0 || timelineSignals.length > 0) {
      dimensions.timelineClarity = 15;
      explanations.push('Target rollout deadline or procurement timeline identified (15/15 pts).');
    } else {
      dimensions.timelineClarity = 0;
      explanations.push('Target close / implementation timeline not clearly defined (0/15 pts).');
    }

    // 4. Decision Maker Identified (Max 15 pts)
    const stakeholderSignals = buyingSignals.filter(
      (s) => s.category === 'stakeholder' || s.category === 'procurement'
    );
    const assignedPersons = actionItems.filter((a) => a.assignedTo && a.responsibleParty === 'customer');
    if (stakeholderSignals.length > 0 || assignedPersons.length > 0) {
      dimensions.decisionMakerIdentified = 15;
      explanations.push('Customer decision makers and stakeholders engaged (15/15 pts).');
    } else {
      dimensions.decisionMakerIdentified = 5;
      explanations.push('Key purchasing authorities and economic buyers remain unverified (5/15 pts).');
    }

    // 5. Buying Signals (Max 20 pts)
    const signalCount = buyingSignals.length;
    if (signalCount >= 3) {
      dimensions.buyingSignals = 20;
      explanations.push(`Strong commercial intent with ${signalCount} verified buying signals (20/20 pts).`);
    } else if (signalCount >= 1) {
      dimensions.buyingSignals = Math.min(20, signalCount * 7);
      explanations.push(`Moderate commercial interest with ${signalCount} buying signal(s) (${dimensions.buyingSignals}/20 pts).`);
    } else {
      dimensions.buyingSignals = 0;
      explanations.push('No explicit customer buying signals detected (0/20 pts).');
    }

    // 6. Objection Resolution (Max 10 pts)
    const totalObjections = objections.length;
    const resolvedObjections = objections.filter((o) => o.status === 'addressed').length;
    if (totalObjections === 0) {
      dimensions.objectionResolution = 10;
      explanations.push('Zero active objections raised during the discussion (10/10 pts).');
    } else if (resolvedObjections === totalObjections) {
      dimensions.objectionResolution = 10;
      explanations.push(`All ${totalObjections} customer objections successfully addressed (10/10 pts).`);
    } else {
      const pending = totalObjections - resolvedObjections;
      dimensions.objectionResolution = Math.max(2, 10 - pending * 4);
      explanations.push(`${pending} open customer objection(s) need resolution (${dimensions.objectionResolution}/10 pts).`);
    }

    // 7. Next-Step Clarity (Max 10 pts)
    const nextSteps = summary.nextSteps || [];
    const validActionItems = actionItems.filter((a) => a.title);
    if (nextSteps.length > 0 || validActionItems.length > 0) {
      dimensions.nextStepClarity = 10;
      explanations.push('Explicit follow-up deliverables and next actions established (10/10 pts).');
    } else {
      dimensions.nextStepClarity = 0;
      explanations.push('No concrete next steps or commitments scheduled (0/10 pts).');
    }

    const totalScore = Math.min(
      100,
      Math.max(
        0,
        Object.values(dimensions).reduce((sum, val) => sum + val, 0)
      )
    );

    const rating = totalScore >= 70 ? 'healthy' : totalScore >= 45 ? 'moderate_risk' : 'severe_risk';

    return {
      totalScore,
      score: totalScore,
      rating,
      dimensionScores: dimensions,
      dimensions,
      explanation: explanations.join(' '),
      calculationVersion: '1.0.0',
      calculatedAt: new Date(),
    };
  }

  calculateDealHealth(analysisData = {}) {
    return this.calculateHealthScore(analysisData);
  }
}

module.exports = new DealHealthService();
