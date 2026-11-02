const AppError = require('../../../utils/appError');
const logger = require('../../../utils/logger');

const VALID_CATEGORIES = [
  'feature',
  'technical',
  'budget',
  'timeline',
  'integration',
  'security',
  'implementation',
  'other',
];
const VALID_IMPORTANCES = ['high', 'medium', 'low'];
const VALID_PRIORITIES = ['urgent', 'high', 'medium', 'low'];
const VALID_PARTIES = ['customer', 'internal', 'unknown'];

/**
 * Validate and clean AI-generated meeting analysis JSON
 */
const validateAndCleanMeetingAnalysis = (data, rawTranscript = '') => {
  if (!data || typeof data !== 'object') {
    throw new AppError('AI response is not a valid JSON object.', 500, 'AI_INVALID_STRUCTURE');
  }

  // 1. Validate Summary
  const summary = data.summary || {};
  const cleanedSummary = {
    executiveSummary: String(summary.executiveSummary || '').trim(),
    purpose: String(summary.purpose || '').trim(),
    currentSituation: String(summary.currentSituation || '').trim(),
    discussionPoints: Array.isArray(summary.discussionPoints) ? summary.discussionPoints.map(String) : [],
    customerExpectations: Array.isArray(summary.customerExpectations)
      ? summary.customerExpectations.map(String)
      : [],
    importantDecisions: Array.isArray(summary.importantDecisions) ? summary.importantDecisions.map(String) : [],
    unresolvedQuestions: Array.isArray(summary.unresolvedQuestions) ? summary.unresolvedQuestions.map(String) : [],
    nextSteps: Array.isArray(summary.nextSteps) ? summary.nextSteps.map(String) : [],
  };

  // Helper to validate and normalize evidence
  const cleanEvidence = (evidence, findingName) => {
    if (!evidence || typeof evidence !== 'object' || !evidence.quote) {
      return null;
    }

    const quote = String(evidence.quote).trim();
    if (!quote) return null;

    // Verify quote exists in transcript if transcript was provided
    if (rawTranscript && !rawTranscript.toLowerCase().includes(quote.toLowerCase().slice(0, 20))) {
      logger.warn(`Evidence quote for '${findingName}' not found verbatim in transcript: "${quote.slice(0, 40)}..."`);
    }

    return {
      startTime: typeof evidence.startTime === 'number' ? evidence.startTime : null,
      endTime: typeof evidence.endTime === 'number' ? evidence.endTime : null,
      quote,
      confidence: typeof evidence.confidence === 'number' ? Math.min(1, Math.max(0, evidence.confidence)) : 0.9,
    };
  };

  // 2. Validate Decision Criteria
  const cleanedCriteria = (Array.isArray(data.decisionCriteria) ? data.decisionCriteria : [])
    .filter((c) => c && c.criterion)
    .map((c) => ({
      criterion: String(c.criterion).trim(),
      category: VALID_CATEGORIES.includes(c.category) ? c.category : 'other',
      importance: VALID_IMPORTANCES.includes(c.importance) ? c.importance : 'medium',
      evidence: cleanEvidence(c.evidence, c.criterion),
    }));

  // 3. Validate Buying Signals
  const cleanedSignals = (Array.isArray(data.buyingSignals) ? data.buyingSignals : [])
    .filter((s) => s && s.signal)
    .map((s) => ({
      signal: String(s.signal).trim(),
      category: String(s.category || 'general').trim(),
      evidence: cleanEvidence(s.evidence, s.signal),
    }));

  // 4. Validate Objections
  const cleanedObjections = (Array.isArray(data.objections) ? data.objections : [])
    .filter((o) => o && o.objection)
    .map((o) => ({
      objection: String(o.objection).trim(),
      category: String(o.category || 'general').trim(),
      status: ['unresolved', 'addressed'].includes(o.status) ? o.status : 'unresolved',
      evidence: cleanEvidence(o.evidence, o.objection),
    }));

  // 5. Validate Risks
  const cleanedRisks = (Array.isArray(data.risks) ? data.risks : [])
    .filter((r) => r && r.risk)
    .map((r) => ({
      risk: String(r.risk).trim(),
      severity: VALID_IMPORTANCES.includes(r.severity) ? r.severity : 'medium',
      evidence: cleanEvidence(r.evidence, r.risk),
    }));

  // 6. Validate Competitors
  const cleanedCompetitors = (Array.isArray(data.competitors) ? data.competitors : [])
    .filter((comp) => comp && comp.name)
    .map((comp) => ({
      name: String(comp.name).trim(),
      products: Array.isArray(comp.products) ? comp.products.map(String) : [],
      comparisonCriteria: String(comp.comparisonCriteria || '').trim(),
      advantages: Array.isArray(comp.advantages) ? comp.advantages.map(String) : [],
      disadvantages: Array.isArray(comp.disadvantages) ? comp.disadvantages.map(String) : [],
      customerPreference: String(comp.customerPreference || '').trim(),
      evidence: cleanEvidence(comp.evidence, comp.name),
    }));

  // 7. Validate Action Items
  const cleanedActionItems = (Array.isArray(data.actionItems) ? data.actionItems : [])
    .filter((a) => a && (a.title || a.task))
    .map((a) => {
      let parsedDate = null;
      if (a.dueDate) {
        const d = new Date(a.dueDate);
        if (!isNaN(d.getTime())) {
          parsedDate = d;
        }
      }

      return {
        title: String(a.title || a.task).trim(),
        description: String(a.description || '').trim(),
        assignedTo: a.assignedTo ? String(a.assignedTo).trim() : null,
        responsibleParty: VALID_PARTIES.includes(a.responsibleParty) ? a.responsibleParty : 'internal',
        dueDate: parsedDate,
        priority: VALID_PRIORITIES.includes(a.priority) ? a.priority : 'medium',
        evidence: cleanEvidence(a.evidence, a.title || a.task),
      };
    });

  return {
    summary: cleanedSummary,
    decisionCriteria: cleanedCriteria,
    buyingSignals: cleanedSignals,
    objections: cleanedObjections,
    risks: cleanedRisks,
    competitors: cleanedCompetitors,
    actionItems: cleanedActionItems,
  };
};

module.exports = {
  validateAndCleanMeetingAnalysis,
};
