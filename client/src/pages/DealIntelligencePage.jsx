import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp,
  Plus,
  Search,
  Filter,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  DollarSign,
  User,
  RefreshCw,
  Eye,
  Building,
  Sparkles,
  ShieldAlert,
  Swords,
  ListTodo,
  ExternalLink,
  Quote,
} from 'lucide-react';
import ApiClient from '../services/api';
import Badge from '../components/common/Badge';
import Modal from '../components/common/Modal';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';

const DealIntelligencePage = () => {
  const [deals, setDeals] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stageFilter, setStageFilter] = useState('');
  const [hygieneFilter, setHygieneFilter] = useState('');
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Selected Deal Intelligence Modal
  const [selectedDealId, setSelectedDealId] = useState(null);
  const [dealIntelligence, setDealIntelligence] = useState(null);
  const [intelLoading, setIntelLoading] = useState(false);

  // Form State
  const [form, setForm] = useState({
    name: '',
    accountName: '',
    amount: '',
    stage: 'discovery',
    closeDate: '',
  });
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const fetchDeals = async () => {
    setIsLoading(true);
    try {
      const res = await ApiClient.get('/deals', {
        stage: stageFilter,
        hygieneStatus: hygieneFilter,
        search,
      });
      if (res.success && res.data) {
        setDeals(res.data.deals || []);
      }
    } catch (err) {
      console.error('Fetch deals error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDeals();
  }, [stageFilter, hygieneFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchDeals();
  };

  const handleOpenDealIntelligence = async (dealId) => {
    setSelectedDealId(dealId);
    setIntelLoading(true);
    setDealIntelligence(null);
    try {
      const res = await ApiClient.get(`/deals/${dealId}/intelligence`);
      if (res.success && res.data) {
        setDealIntelligence(res.data);
      }
    } catch (err) {
      console.error('Failed to load deal intelligence:', err);
    } finally {
      setIntelLoading(false);
    }
  };

  const handleCreateDeal = async (e) => {
    e.preventDefault();
    setFormSubmitting(true);
    setFormError('');

    try {
      const res = await ApiClient.post('/deals', {
        name: form.name,
        accountName: form.accountName,
        amount: Number(form.amount),
        stage: form.stage,
        closeDate: form.closeDate,
      });

      if (res.success) {
        setIsModalOpen(false);
        setForm({
          name: '',
          accountName: '',
          amount: '',
          stage: 'discovery',
          closeDate: '',
        });
        fetchDeals();
      }
    } catch (err) {
      setFormError(err.message || 'Failed to create deal.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleStageChange = async (dealId, newStage, e) => {
    if (e) e.stopPropagation();
    try {
      await ApiClient.patch(`/deals/${dealId}`, { stage: newStage });
      fetchDeals();
    } catch (err) {
      alert(err.message || 'Failed to update deal stage');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div className="page-header-container">
        <div>
          <h2 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em', margin: 0 }}>
            Deal Intelligence & Pipeline Hygiene
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            Explainable deal health evaluation synthesized across multi-meeting customer audio transcripts
          </p>
        </div>

        <button onClick={() => setIsModalOpen(true)} className="btn btn-primary">
          <Plus size={16} /> Add Opportunity
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="card filter-toolbar">
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', flex: 1, minWidth: 240, position: 'relative' }}>
          <input
            type="text"
            placeholder="Search deals or accounts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: '2.4rem' }}
          />
          <Search
            size={16}
            style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }}
          />
        </form>

        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          style={{ width: 'auto', minWidth: 140 }}
        >
          <option value="">All Stages</option>
          <option value="discovery">Discovery</option>
          <option value="qualification">Qualification</option>
          <option value="demo">Demo</option>
          <option value="proposal">Proposal</option>
          <option value="negotiation">Negotiation</option>
          <option value="closed_won">Closed Won</option>
          <option value="closed_lost">Closed Lost</option>
        </select>

        <select
          value={hygieneFilter}
          onChange={(e) => setHygieneFilter(e.target.value)}
          style={{ width: 'auto', minWidth: 150 }}
        >
          <option value="">All Hygiene States</option>
          <option value="healthy">Healthy Only</option>
          <option value="at_risk">At Risk Only</option>
          <option value="stale">Stale Only</option>
        </select>

        <button onClick={fetchDeals} className="btn btn-secondary btn-sm" title="Refresh">
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Deals Table */}
      {isLoading ? (
        <div style={{ padding: '4rem', display: 'flex', justifyContent: 'center' }}>
          <LoadingSpinner size="lg" message="Loading pipeline opportunities..." />
        </div>
      ) : deals.length === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title="No opportunities found"
          description={search ? 'No deals match your filter criteria.' : 'Create your first deal opportunity.'}
          actionLabel="Create Opportunity"
          onAction={() => setIsModalOpen(true)}
        />
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Opportunity / Account</th>
                <th>Amount</th>
                <th>Stage</th>
                <th>Target Close</th>
                <th>Hygiene Score</th>
                <th>Detected Risk Factors</th>
                <th>Owner</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {deals.map((deal) => (
                <tr
                  key={deal._id}
                  onClick={() => handleOpenDealIntelligence(deal._id)}
                  style={{ cursor: 'pointer' }}
                >
                  <td>
                    <div>
                      <strong style={{ fontSize: '0.925rem' }}>{deal.name}</strong>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{deal.accountName}</p>
                    </div>
                  </td>
                  <td>
                    <span style={{ fontWeight: 700 }}>${deal.amount?.toLocaleString()}</span>
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <select
                      value={deal.stage}
                      onChange={(e) => handleStageChange(deal._id, e.target.value, e)}
                      style={{
                        padding: '0.25rem 0.5rem',
                        fontSize: '0.785rem',
                        width: 'auto',
                        background: 'rgba(255, 255, 255, 0.04)',
                        borderRadius: 'var(--radius-xs)',
                      }}
                    >
                      <option value="discovery">Discovery</option>
                      <option value="qualification">Qualification</option>
                      <option value="demo">Demo</option>
                      <option value="proposal">Proposal</option>
                      <option value="negotiation">Negotiation</option>
                      <option value="closed_won">Closed Won</option>
                      <option value="closed_lost">Closed Lost</option>
                    </select>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      <Calendar size={13} />
                      {new Date(deal.closeDate).toLocaleDateString()}
                    </div>
                  </td>
                  <td>
                    <Badge variant={deal.hygieneStatus}>
                      {deal.hygieneScore}% &bull; {deal.hygieneStatus.replace('_', ' ')}
                    </Badge>
                  </td>
                  <td style={{ maxWidth: 260 }}>
                    {deal.riskReasons?.length > 0 ? (
                      <ul style={{ margin: 0, paddingLeft: '1rem', fontSize: '0.785rem', color: 'var(--warning)' }}>
                        {deal.riskReasons.map((r, idx) => (
                          <li key={idx}>{r}</li>
                        ))}
                      </ul>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.785rem', color: 'var(--success)' }}>
                        <CheckCircle2 size={13} /> Clean record
                      </div>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.825rem' }}>
                      <User size={13} style={{ color: 'var(--text-dim)' }} />
                      <span>{deal.ownerId?.name || 'Unassigned'}</span>
                    </div>
                  </td>
                  <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handleOpenDealIntelligence(deal._id)}
                      className="btn btn-secondary btn-sm"
                      title="Inspect Voice Intelligence"
                    >
                      <Eye size={13} /> Intelligence
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Deal Voice Intelligence Inspection Modal */}
      {selectedDealId && (
        <Modal
          isOpen={!!selectedDealId}
          onClose={() => setSelectedDealId(null)}
          title={dealIntelligence?.deal?.name ? `Deal Intelligence: ${dealIntelligence.deal.name}` : 'Deal Intelligence'}
          maxWidth={820}
        >
          {intelLoading ? (
            <div style={{ padding: '3rem', display: 'flex', justifyContent: 'center' }}>
              <LoadingSpinner size="md" message="Synthesizing multi-call voice intelligence..." />
            </div>
          ) : dealIntelligence ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Top Summary Bar */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <Badge variant="primary">{dealIntelligence.deal.accountName}</Badge>
                  <Badge variant="neutral">Stage: {dealIntelligence.deal.stage}</Badge>
                  <Badge variant="neutral">Target: ${dealIntelligence.deal.amount?.toLocaleString()}</Badge>
                  <Badge variant={dealIntelligence.deal.hygieneStatus}>
                    Hygiene: {dealIntelligence.deal.hygieneScore}% ({dealIntelligence.deal.hygieneStatus})
                  </Badge>
                </div>

                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {dealIntelligence.meetings?.length || 0} Recorded Meeting(s)
                </span>
              </div>

              {/* Deal Health Composite Card */}
              {dealIntelligence.aggregatedIntelligence?.dealHealth && (
                <div
                  style={{
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.85rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Sparkles size={18} style={{ color: 'var(--primary)' }} />
                      <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                        Voice Deal Health Score: {dealIntelligence.aggregatedIntelligence.dealHealth.score}%
                      </h4>
                    </div>
                    <Badge
                      variant={
                        dealIntelligence.aggregatedIntelligence.dealHealth.score >= 70
                          ? 'success'
                          : dealIntelligence.aggregatedIntelligence.dealHealth.score >= 45
                          ? 'warning'
                          : 'danger'
                      }
                    >
                      {dealIntelligence.aggregatedIntelligence.dealHealth.rating.replace('_', ' ')}
                    </Badge>
                  </div>

                  <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.45 }}>
                    {dealIntelligence.aggregatedIntelligence.dealHealth.explanation}
                  </p>

                  {/* 7 Dimensions */}
                  {dealIntelligence.aggregatedIntelligence.dealHealth.dimensions && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.5rem', marginTop: '0.25rem' }}>
                      {Object.entries(dealIntelligence.aggregatedIntelligence.dealHealth.dimensions).map(([key, val]) => (
                        <div key={key} style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '0.45rem 0.65rem', borderRadius: 'var(--radius-xs)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.725rem', color: 'var(--text-dim)' }}>
                            <span style={{ textTransform: 'capitalize' }}>{key.replace(/([A-Z])/g, ' $1')}</span>
                            <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{val}%</span>
                          </div>
                          <div style={{ height: '3px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: 2, marginTop: '0.2rem', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${val}%`, background: val >= 70 ? 'var(--success)' : val >= 40 ? 'var(--warning)' : 'var(--danger)' }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Linked Meetings List */}
              {dealIntelligence.meetings?.length > 0 && (
                <div>
                  <h5 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                    Linked Call Recordings ({dealIntelligence.meetings.length})
                  </h5>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {dealIntelligence.meetings.map((m) => (
                      <div
                        key={m._id}
                        style={{
                          padding: '0.65rem 0.85rem',
                          background: 'rgba(255, 255, 255, 0.02)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-sm)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <div>
                          <strong style={{ fontSize: '0.85rem', color: 'var(--text-main)' }}>{m.title}</strong>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginLeft: '0.5rem' }}>
                            {new Date(m.scheduledStartTime).toLocaleDateString()} &bull; {m.durationMinutes}m
                          </span>
                        </div>
                        <Link to={`/meetings/${m._id}`} className="btn btn-secondary btn-sm" style={{ fontSize: '0.75rem' }}>
                          Open Workspace <ExternalLink size={11} />
                        </Link>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Decision Criteria */}
              {dealIntelligence.aggregatedIntelligence?.decisionCriteria?.length > 0 && (
                <div>
                  <h5 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                    Extracted Decision Criteria
                  </h5>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    {dealIntelligence.aggregatedIntelligence.decisionCriteria.map((c, idx) => (
                      <div key={idx} style={{ fontSize: '0.825rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <CheckCircle2 size={13} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                        <span>{c.criterion}</span>
                        <Badge variant="neutral">{c.category}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Buying Signals */}
              {dealIntelligence.aggregatedIntelligence?.buyingSignals?.length > 0 && (
                <div>
                  <h5 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--success)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                    Verified Buying Signals
                  </h5>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    {dealIntelligence.aggregatedIntelligence.buyingSignals.map((s, idx) => (
                      <div key={idx} style={{ fontSize: '0.825rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span style={{ color: 'var(--success)', fontWeight: 700 }}>✓</span>
                        <span>{s.signal}</span>
                        <Badge variant="success">{s.category.replace('_', ' ')}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Active Risks & Objections */}
              {dealIntelligence.aggregatedIntelligence?.activeRisks?.length > 0 && (
                <div>
                  <h5 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--warning)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                    Active Risks & Customer Objections
                  </h5>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    {dealIntelligence.aggregatedIntelligence.activeRisks.map((r, idx) => (
                      <div key={idx} style={{ fontSize: '0.825rem', color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <AlertTriangle size={13} style={{ flexShrink: 0 }} />
                        <span>{r.objection}</span>
                        <Badge variant="warning">{r.severity} severity</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Competitors */}
              {dealIntelligence.aggregatedIntelligence?.competitors?.length > 0 && (
                <div>
                  <h5 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--danger)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                    Competitors Mentioned
                  </h5>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {dealIntelligence.aggregatedIntelligence.competitors.map((comp, idx) => (
                      <Badge key={idx} variant={comp.displacementRisk === 'high' ? 'danger' : 'neutral'}>
                        {comp.competitorName} ({comp.displacementRisk} risk)
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '0.5rem' }}>
                <button onClick={() => setSelectedDealId(null)} className="btn btn-secondary btn-sm">
                  Close
                </button>
              </div>
            </div>
          ) : (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-dim)' }}>
              No intelligence available for this deal.
            </div>
          )}
        </Modal>
      )}

      {/* Add Opportunity Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create Deal Opportunity">
        {formError && (
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
            {formError}
          </div>
        )}

        <form onSubmit={handleCreateDeal} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
              Opportunity Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Enterprise Platform Expansion"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

          <div className="responsive-grid-2col">
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                Account / Client Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. NexaCorp Inc"
                value={form.accountName}
                onChange={(e) => setForm({ ...form, accountName: e.target.value })}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                Deal Amount ($) *
              </label>
              <input
                type="number"
                min="0"
                required
                placeholder="50000"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </div>
          </div>

          <div className="responsive-grid-2col">
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                Initial Pipeline Stage
              </label>
              <select value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value })}>
                <option value="discovery">Discovery</option>
                <option value="qualification">Qualification</option>
                <option value="demo">Demo</option>
                <option value="proposal">Proposal</option>
                <option value="negotiation">Negotiation</option>
                <option value="closed_won">Closed Won</option>
                <option value="closed_lost">Closed Lost</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                Target Close Date *
              </label>
              <input
                type="date"
                required
                value={form.closeDate}
                onChange={(e) => setForm({ ...form, closeDate: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary btn-sm">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={formSubmitting}>
              {formSubmitting ? 'Creating...' : 'Create Opportunity'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default DealIntelligencePage;
