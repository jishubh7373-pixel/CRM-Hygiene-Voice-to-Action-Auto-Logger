import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import ApiClient from '../../services/api';
import Modal from '../common/Modal';

const ReviewInsightsModal = ({ isOpen, onClose, meetingId, currentInsights, onSaved }) => {
  const [purpose, setPurpose] = useState('');
  const [situation, setSituation] = useState('');
  const [discussionPoints, setDiscussionPoints] = useState('');
  const [customerExpectations, setCustomerExpectations] = useState('');
  const [decisions, setDecisions] = useState('');
  const [unresolvedQuestions, setUnresolvedQuestions] = useState('');
  const [nextSteps, setNextSteps] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (currentInsights?.summary) {
      const s = currentInsights.summary;
      setPurpose(s.purpose || '');
      setSituation(s.customerSituation || '');
      setDiscussionPoints((s.mainDiscussionPoints || []).join('\n'));
      setCustomerExpectations((s.customerExpectations || []).join('\n'));
      setDecisions((s.decisions || []).join('\n'));
      setUnresolvedQuestions((s.unresolvedQuestions || []).join('\n'));
      setNextSteps((s.nextSteps || []).join('\n'));
    }
  }, [currentInsights]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    const splitLines = (str) =>
      str
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);

    const updatedSummary = {
      purpose: purpose.trim(),
      customerSituation: situation.trim(),
      mainDiscussionPoints: splitLines(discussionPoints),
      customerExpectations: splitLines(customerExpectations),
      decisions: splitLines(decisions),
      unresolvedQuestions: splitLines(unresolvedQuestions),
      nextSteps: splitLines(nextSteps),
    };

    try {
      const res = await ApiClient.patch(`/meetings/${meetingId}/insights`, {
        summary: updatedSummary,
      });

      if (res.success && res.data?.insights) {
        if (onSaved) onSaved(res.data.insights);
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Failed to update meeting intelligence review.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Human Review & Intelligence Verification" maxWidth={680}>
      {error && (
        <div
          style={{
            padding: '0.75rem',
            background: 'var(--danger-subtle)',
            border: '1px solid var(--danger-border)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--danger)',
            fontSize: '0.85rem',
            marginBottom: '1rem',
          }}
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', margin: 0 }}>
          Verify and refine AI-extracted executive summary fields. Saving marks this meeting as reviewed with audit trail timestamps.
        </p>

        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
            Meeting Purpose
          </label>
          <input
            type="text"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            placeholder="Primary objective of the meeting..."
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
            Customer's Current Situation & Pain Points
          </label>
          <textarea
            rows="2"
            value={situation}
            onChange={(e) => setSituation(e.target.value)}
            placeholder="Context regarding current infrastructure, team size, challenges..."
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
              Main Discussion Points (one per line)
            </label>
            <textarea
              rows="3"
              value={discussionPoints}
              onChange={(e) => setDiscussionPoints(e.target.value)}
              placeholder="Key topic 1&#10;Key topic 2"
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
              Customer Expectations (one per line)
            </label>
            <textarea
              rows="3"
              value={customerExpectations}
              onChange={(e) => setCustomerExpectations(e.target.value)}
              placeholder="Expectation 1&#10;Expectation 2"
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
              Important Decisions Agreed
            </label>
            <textarea
              rows="3"
              value={decisions}
              onChange={(e) => setDecisions(e.target.value)}
              placeholder="Decision 1&#10;Decision 2"
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
              Unresolved Questions / Blockers
            </label>
            <textarea
              rows="3"
              value={unresolvedQuestions}
              onChange={(e) => setUnresolvedQuestions(e.target.value)}
              placeholder="Open question 1&#10;Open question 2"
            />
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
            Next Steps (one per line)
          </label>
          <textarea
            rows="2"
            value={nextSteps}
            onChange={(e) => setNextSteps(e.target.value)}
            placeholder="Next step 1&#10;Next step 2"
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
          <button type="button" onClick={onClose} className="btn btn-secondary btn-sm" disabled={isSubmitting}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary btn-sm" disabled={isSubmitting}>
            <CheckCircle2 size={14} />
            {isSubmitting ? 'Saving Review...' : 'Approve & Save Review'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default ReviewInsightsModal;
