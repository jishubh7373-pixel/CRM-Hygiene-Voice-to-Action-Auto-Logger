import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  RefreshCw,
  Clock,
  User,
  Building,
  CheckCircle2,
  AlertTriangle,
  PlayCircle,
  FileText,
  TrendingUp,
  ShieldAlert,
  Swords,
  ListTodo,
  Sparkles,
  Download,
  Search,
  Quote,
  Check,
  Edit3,
  Calendar,
  DollarSign,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import ApiClient from '../services/api';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import Badge from '../components/common/Badge';
import LoadingSpinner from '../components/common/LoadingSpinner';
import AudioPlayer from '../components/meetings/AudioPlayer';
import ReviewInsightsModal from '../components/meetings/ReviewInsightsModal';

const TABS = [
  { id: 'overview', label: 'Executive Overview', icon: Sparkles },
  { id: 'transcript', label: 'Full Transcript', icon: FileText },
  { id: 'criteria', label: 'Decision Criteria', icon: CheckCircle2 },
  { id: 'signals', label: 'Buying Signals', icon: TrendingUp },
  { id: 'risks', label: 'Risks & Objections', icon: ShieldAlert },
  { id: 'competitors', label: 'Competitor Intel', icon: Swords },
  { id: 'actions', label: 'Action Commitments', icon: ListTodo },
];

const MeetingDetailsPage = () => {
  const { id } = useParams();
  const { socket } = useSocket();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState('overview');
  const [meeting, setMeeting] = useState(null);
  const [transcript, setTranscript] = useState(null);
  const [insights, setInsights] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [reprocessing, setReprocessing] = useState(false);
  const [reprocessSuccess, setReprocessSuccess] = useState('');

  // Audio seek synchronization
  const [seekTime, setSeekTime] = useState(null);

  // Transcript search
  const [transcriptSearch, setTranscriptSearch] = useState('');

  // Review modal
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);

  // Fetch full meeting data
  const loadMeetingData = async (silent = false) => {
    if (!silent) setIsLoading(true);
    setErrorMessage('');

    try {
      const [mRes, tRes, iRes] = await Promise.allSettled([
        ApiClient.get(`/meetings/${id}`),
        ApiClient.get(`/meetings/${id}/transcript`),
        ApiClient.get(`/meetings/${id}/insights`),
      ]);

      if (mRes.status === 'fulfilled' && mRes.value.success) {
        setMeeting(mRes.value.data.meeting);
      } else {
        throw new Error('Failed to load meeting details.');
      }

      if (tRes.status === 'fulfilled' && tRes.value.success) {
        setTranscript(tRes.value.data);
      }

      if (iRes.status === 'fulfilled' && iRes.value.success) {
        setInsights(iRes.value.data.insights);
      }
    } catch (err) {
      setErrorMessage(err.message || 'Error loading meeting workspace');
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMeetingData();
  }, [id]);

  // Real-time Socket.IO Listeners
  useEffect(() => {
    if (!socket) return;

    const handleStatusUpdate = (data) => {
      if (data.meetingId === id) {
        setMeeting((prev) => (prev ? { ...prev, ...data } : prev));
        loadMeetingData(true);
      }
    };

    const handleTranscriptUpdate = (data) => {
      if (data.meetingId === id) {
        loadMeetingData(true);
      }
    };

    const handleInsightsUpdate = (data) => {
      if (data.meetingId === id) {
        setInsights(data.insights);
        loadMeetingData(true);
      }
    };

    const handleErrorUpdate = (data) => {
      if (data.meetingId === id) {
        setErrorMessage(data.error || 'Meeting processing failure occurred.');
        loadMeetingData(true);
      }
    };

    socket.on('meeting:status', handleStatusUpdate);
    socket.on('meeting:transcript', handleTranscriptUpdate);
    socket.on('meeting:insights', handleInsightsUpdate);
    socket.on('meeting:error', handleErrorUpdate);

    return () => {
      socket.off('meeting:status', handleStatusUpdate);
      socket.off('meeting:transcript', handleTranscriptUpdate);
      socket.off('meeting:insights', handleInsightsUpdate);
      socket.off('meeting:error', handleErrorUpdate);
    };
  }, [socket, id]);

  // Polling fallback when processing
  useEffect(() => {
    if (!meeting) return;
    const isProcessing =
      meeting.processingStatus === 'processing' ||
      meeting.processingStatus === 'pending' ||
      meeting.transcriptionStatus === 'processing' ||
      meeting.analysisStatus === 'processing';

    if (!isProcessing) return;

    const interval = setInterval(() => {
      loadMeetingData(true);
    }, 4000);

    return () => clearInterval(interval);
  }, [meeting?.processingStatus, meeting?.transcriptionStatus, meeting?.analysisStatus]);

  const handleReprocess = async () => {
    setReprocessing(true);
    setReprocessSuccess('');
    try {
      const res = await ApiClient.post(`/meetings/${id}/reprocess`);
      if (res.success) {
        setReprocessSuccess('Reprocessing pipeline queued successfully.');
        loadMeetingData(true);
      }
    } catch (err) {
      alert(err.message || 'Failed to trigger reprocessing');
    } finally {
      setReprocessing(false);
    }
  };

  const handleActionToggle = async (actionItem) => {
    const nextStatus = actionItem.status === 'completed' ? 'pending' : 'completed';
    try {
      await ApiClient.patch(`/actions/${actionItem._id}/status`, { status: nextStatus });
      loadMeetingData(true);
    } catch (err) {
      alert(err.message || 'Failed to toggle action item');
    }
  };

  const handleSeek = (timeInSec) => {
    setSeekTime(timeInSec);
  };

  const exportTranscript = (format) => {
    if (!transcript?.segments?.length) return;

    let content = '';
    let mime = 'text/plain';
    let filename = `${meeting?.title || 'meeting'}_transcript.${format}`;

    if (format === 'json') {
      content = JSON.stringify(transcript.segments, null, 2);
      mime = 'application/json';
    } else {
      content = transcript.segments
        .map((s) => {
          const m1 = Math.floor(s.startTime / 60);
          const s1 = Math.floor(s.startTime % 60);
          const time = `[${m1}:${s1 < 10 ? '0' : ''}${s1}]`;
          return `${time} ${s.speaker}: ${s.text}`;
        })
        .join('\n\n');
    }

    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div style={{ padding: '5rem', display: 'flex', justifyContent: 'center' }}>
        <LoadingSpinner size="lg" message="Loading voice intelligence workspace..." />
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
        <AlertTriangle size={36} style={{ color: 'var(--warning)', margin: '0 auto 1rem' }} />
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>Meeting Not Found</h3>
        <p style={{ color: 'var(--text-muted)', marginTop: '0.4rem' }}>
          This meeting does not exist or you do not have permission to access it.
        </p>
        <Link to="/meetings" className="btn btn-primary" style={{ display: 'inline-flex', marginTop: '1.25rem' }}>
          <ArrowLeft size={16} /> Back to Meetings
        </Link>
      </div>
    );
  }

  const filteredSegments = (transcript?.segments || []).filter((s) =>
    transcriptSearch ? s.text.toLowerCase().includes(transcriptSearch.toLowerCase()) : true
  );

  const dealHealth = insights?.dealHealth || {
    score: 0,
    rating: 'uncalculated',
    dimensions: {},
    explanation: 'Deal health has not yet been computed.',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Breadcrumb & Actions Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Link to="/meetings" className="btn btn-secondary btn-sm" title="Back to Meetings">
            <ArrowLeft size={15} /> Back
          </Link>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em', margin: 0 }}>
                {meeting.title}
              </h2>
              {(meeting.sourceMetadata?.isDemo || meeting.sourceMetadata?.isSeed || meeting.title?.includes('Technical Architecture Review')) && (
                <span
                  style={{
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    background: 'rgba(234, 179, 8, 0.15)',
                    color: 'var(--warning)',
                    border: '1px solid rgba(234, 179, 8, 0.3)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.15rem 0.5rem',
                  }}
                >
                  Demo Seed Data
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.25rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <Building size={13} /> {meeting.clientName}
              </span>
              <span>&bull;</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <Calendar size={13} /> {new Date(meeting.scheduledStartTime).toLocaleDateString()}
              </span>
              {meeting.durationMinutes > 0 && (
                <>
                  <span>&bull;</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <Clock size={13} /> {meeting.durationMinutes}m
                  </span>
                </>
              )}
              {meeting.dealId && (
                <>
                  <span>&bull;</span>
                  <Link
                    to="/deals"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      color: 'var(--primary)',
                      textDecoration: 'none',
                      fontWeight: 600,
                    }}
                  >
                    <DollarSign size={13} /> Deal: {meeting.dealId.name} <ExternalLink size={11} />
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <button
            onClick={() => setIsReviewModalOpen(true)}
            className="btn btn-secondary btn-sm"
            title="Review & edit executive summary"
          >
            <Edit3 size={14} /> Review Summary
          </button>

          <button
            onClick={handleReprocess}
            disabled={reprocessing || meeting.processingStatus === 'processing'}
            className="btn btn-secondary btn-sm"
            title="Re-run transcription and AI intelligence extraction"
          >
            <RefreshCw size={14} className={reprocessing ? 'spin' : ''} />
            {reprocessing ? 'Queuing...' : 'Reprocess Meeting'}
          </button>
        </div>
      </div>

      {/* Demo Seed Data Informational Banner */}
      {(meeting.sourceMetadata?.isDemo || meeting.sourceMetadata?.isSeed || meeting.title?.includes('Technical Architecture Review')) && (
        <div
          style={{
            padding: '0.75rem 1rem',
            background: 'rgba(234, 179, 8, 0.08)',
            border: '1px solid rgba(234, 179, 8, 0.25)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text-muted)',
            fontSize: '0.825rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
          }}
        >
          <AlertTriangle size={16} style={{ color: 'var(--warning)', flexShrink: 0 }} />
          <span>
            <strong style={{ color: 'var(--warning)' }}>Reference Demo Record:</strong> This meeting illustrates DealFlow AI's deep intelligence capabilities (transcript speaker diarization, decision criteria, objections, and buying signals) using pre-seeded reference data. Real customer call recordings uploaded to DealFlow AI are transcribed via OpenAI Whisper.
          </span>
        </div>
      )}

      {/* Reprocess Notice */}
      {reprocessSuccess && (
        <div
          style={{
            padding: '0.65rem 1rem',
            background: 'var(--success-subtle)',
            border: '1px solid var(--success-border)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--success)',
            fontSize: '0.85rem',
          }}
        >
          {reprocessSuccess}
        </div>
      )}

      {/* Processing Status Banner */}
      {meeting.processingStatus === 'processing' && (
        <div
          style={{
            padding: '0.85rem 1.25rem',
            background: 'rgba(99, 102, 241, 0.1)',
            border: '1px solid var(--primary-border)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.85rem',
          }}
        >
          <LoadingSpinner size="sm" />
          <div style={{ fontSize: '0.85rem', color: 'var(--text-main)' }}>
            <strong>Pipeline Running:</strong> Whisper transcription and structured AI intelligence extraction in progress.
            Updates appear live via WebSockets.
          </div>
        </div>
      )}

      {/* Status Badges Bar */}
      <div className="card" style={{ padding: '0.85rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase' }}>
            Pipeline Status:
          </span>

          <Badge variant={meeting.audioStorage?.stored ? 'success' : 'neutral'}>
            Audio: {meeting.audioStorage?.stored ? 'Secured' : 'Missing'}
          </Badge>

          <Badge
            variant={
              meeting.transcriptionStatus === 'completed'
                ? 'success'
                : meeting.transcriptionStatus === 'processing'
                ? 'primary'
                : meeting.transcriptionStatus === 'failed'
                ? 'danger'
                : 'neutral'
            }
          >
            Transcription: {meeting.transcriptionStatus}
          </Badge>

          <Badge
            variant={
              meeting.analysisStatus === 'completed'
                ? 'success'
                : meeting.analysisStatus === 'processing'
                ? 'primary'
                : meeting.analysisStatus === 'failed'
                ? 'danger'
                : 'neutral'
            }
          >
            AI Intelligence: {meeting.analysisStatus}
          </Badge>

          {insights?.reviewMetadata?.isReviewed ? (
            <Badge variant="success">
              ✓ Reviewed by {insights.reviewMetadata.reviewedBy?.name || 'Representative'}
            </Badge>
          ) : (
            <Badge variant="warning">Pending Human Review</Badge>
          )}
        </div>

        {meeting.audioStorage?.originalFileName && (
          <span style={{ fontSize: '0.785rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
            {meeting.audioStorage.originalFileName} ({(meeting.audioStorage.fileSize / (1024 * 1024)).toFixed(2)} MB)
          </span>
        )}
      </div>

      {/* Audio Player Component */}
      {meeting.audioStorage?.stored && (
        <AudioPlayer meetingId={meeting._id} seekTime={seekTime} />
      )}

      {/* 7 Interactive Workspace Tabs */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Navigation Tabs Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            borderBottom: '1px solid var(--border-light)',
            overflowX: 'auto',
            paddingBottom: '0.2rem',
          }}
        >
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.65rem 1rem',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  background: isActive ? 'var(--primary-subtle)' : 'transparent',
                  color: isActive ? 'var(--primary)' : 'var(--text-muted)',
                  fontSize: '0.85rem',
                  fontWeight: isActive ? 700 : 500,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  borderBottom: isActive ? '2px solid var(--primary)' : '2px solid transparent',
                  transition: 'all 0.15s ease',
                }}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab 1: Executive Overview */}
        {activeTab === 'overview' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '1.25rem' }}>
            {/* Left Column: Structured Summary */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                    Executive Summary & Conversation Profile
                  </h3>
                  {insights?.reviewMetadata?.isReviewed && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--success)' }}>
                      Certified on {new Date(insights.reviewMetadata.reviewedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>

                {/* Meeting Purpose */}
                {insights?.summary?.purpose && (
                  <div>
                    <h5 style={{ fontSize: '0.785rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                      Primary Meeting Purpose
                    </h5>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-main)', margin: 0, lineHeight: 1.5 }}>
                      {insights.summary.purpose}
                    </p>
                  </div>
                )}

                {/* Customer Situation */}
                {insights?.summary?.customerSituation && (
                  <div>
                    <h5 style={{ fontSize: '0.785rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                      Customer Situation & Environment
                    </h5>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-main)', margin: 0, lineHeight: 1.5 }}>
                      {insights.summary.customerSituation}
                    </p>
                  </div>
                )}

                {/* Main Discussion Points */}
                {insights?.summary?.mainDiscussionPoints?.length > 0 && (
                  <div>
                    <h5 style={{ fontSize: '0.785rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                      Key Discussion Points
                    </h5>
                    <ul style={{ paddingLeft: '1.25rem', margin: 0, display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.875rem', color: 'var(--text-main)' }}>
                      {insights.summary.mainDiscussionPoints.map((pt, idx) => (
                        <li key={idx}>{pt}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Customer Expectations */}
                {insights?.summary?.customerExpectations?.length > 0 && (
                  <div>
                    <h5 style={{ fontSize: '0.785rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                      Customer Expectations & Deliverables
                    </h5>
                    <ul style={{ paddingLeft: '1.25rem', margin: 0, display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.875rem', color: 'var(--text-main)' }}>
                      {insights.summary.customerExpectations.map((exp, idx) => (
                        <li key={idx}>{exp}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Important Decisions */}
                {insights?.summary?.decisions?.length > 0 && (
                  <div>
                    <h5 style={{ fontSize: '0.785rem', fontWeight: 700, color: 'var(--success)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                      Agreed Decisions
                    </h5>
                    <ul style={{ paddingLeft: '1.25rem', margin: 0, display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.875rem', color: 'var(--text-main)' }}>
                      {insights.summary.decisions.map((dec, idx) => (
                        <li key={idx}>{dec}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Unresolved Questions */}
                {insights?.summary?.unresolvedQuestions?.length > 0 && (
                  <div>
                    <h5 style={{ fontSize: '0.785rem', fontWeight: 700, color: 'var(--warning)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                      Unresolved Questions & Follow-ups
                    </h5>
                    <ul style={{ paddingLeft: '1.25rem', margin: 0, display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.875rem', color: 'var(--warning)' }}>
                      {insights.summary.unresolvedQuestions.map((q, idx) => (
                        <li key={idx}>{q}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Next Steps */}
                {insights?.summary?.nextSteps?.length > 0 && (
                  <div>
                    <h5 style={{ fontSize: '0.785rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                      Next Steps
                    </h5>
                    <ul style={{ paddingLeft: '1.25rem', margin: 0, display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.875rem', color: 'var(--text-main)' }}>
                      {insights.summary.nextSteps.map((step, idx) => (
                        <li key={idx}>{step}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {!insights?.summary && (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', fontStyle: 'italic' }}>
                    Summary intelligence is generating or awaiting transcription...
                  </p>
                )}
              </div>
            </div>

            {/* Right Column: Explainable Deal Health Card */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                    Deal Health Evaluation
                  </h4>
                  <Badge
                    variant={
                      dealHealth.score >= 70
                        ? 'success'
                        : dealHealth.score >= 45
                        ? 'warning'
                        : 'danger'
                    }
                  >
                    {dealHealth.score}/100 &bull; {dealHealth.rating.replace('_', ' ')}
                  </Badge>
                </div>

                {/* Score Big Display */}
                <div
                  style={{
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '1rem',
                    textAlign: 'center',
                  }}
                >
                  <span
                    style={{
                      fontSize: '2.5rem',
                      fontWeight: 800,
                      fontFamily: 'var(--font-mono)',
                      color:
                        dealHealth.score >= 70
                          ? 'var(--success)'
                          : dealHealth.score >= 45
                          ? 'var(--warning)'
                          : 'var(--danger)',
                    }}
                  >
                    {dealHealth.score}%
                  </span>
                  <p style={{ fontSize: '0.785rem', color: 'var(--text-dim)', margin: '0.2rem 0 0 0' }}>
                    Composite Score across 7 Intelligence Dimensions
                  </p>
                </div>

                {/* 7 Dimensions Breakdown */}
                {dealHealth.dimensions && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                    {Object.entries(dealHealth.dimensions).map(([key, val]) => (
                      <div key={key}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.2rem' }}>
                          <span style={{ color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                            {key.replace(/([A-Z])/g, ' $1')}
                          </span>
                          <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-main)' }}>
                            {val}%
                          </span>
                        </div>
                        <div
                          style={{
                            height: '5px',
                            background: 'rgba(255, 255, 255, 0.08)',
                            borderRadius: 'var(--radius-full)',
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              height: '100%',
                              width: `${Math.min(100, Math.max(0, val))}%`,
                              background:
                                val >= 70 ? 'var(--success)' : val >= 40 ? 'var(--warning)' : 'var(--danger)',
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* AI Explainability */}
                <div
                  style={{
                    fontSize: '0.8rem',
                    color: 'var(--text-muted)',
                    background: 'rgba(255, 255, 255, 0.02)',
                    padding: '0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    borderLeft: '3px solid var(--primary)',
                    lineHeight: 1.45,
                  }}
                >
                  <p style={{ fontWeight: 600, color: 'var(--text-main)', margin: '0 0 0.25rem 0' }}>
                    Scoring Rationale:
                  </p>
                  {dealHealth.explanation}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Full Transcript */}
        {activeTab === 'transcript' && (
          <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div style={{ position: 'relative', minWidth: 280, flex: 1 }}>
                <input
                  type="text"
                  placeholder="Search transcript segments..."
                  value={transcriptSearch}
                  onChange={(e) => setTranscriptSearch(e.target.value)}
                  style={{ paddingLeft: '2.3rem' }}
                />
                <Search
                  size={15}
                  style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button onClick={() => exportTranscript('txt')} className="btn btn-secondary btn-sm">
                  <Download size={13} /> Export TXT
                </button>
                <button onClick={() => exportTranscript('json')} className="btn btn-secondary btn-sm">
                  <Download size={13} /> Export JSON
                </button>
              </div>
            </div>

            {/* Segments Stream */}
            {filteredSegments.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-dim)' }}>
                {transcriptSearch ? 'No segments match your search phrase.' : 'No transcript segments available.'}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', maxHeight: 600, overflowY: 'auto' }}>
                {filteredSegments.map((segment) => {
                  const m1 = Math.floor(segment.startTime / 60);
                  const s1 = Math.floor(segment.startTime % 60);
                  const m2 = Math.floor(segment.endTime / 60);
                  const s2 = Math.floor(segment.endTime % 60);
                  const timeLabel = `${m1}:${s1 < 10 ? '0' : ''}${s1} - ${m2}:${s2 < 10 ? '0' : ''}${s2}`;

                  return (
                    <div
                      key={segment._id || segment.segmentIndex}
                      style={{
                        padding: '0.85rem 1rem',
                        background: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-sm)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.35rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)' }}>
                            {segment.speaker || 'Speaker'}
                          </span>
                          <button
                            onClick={() => handleSeek(segment.startTime)}
                            className="btn btn-secondary btn-sm"
                            style={{
                              fontSize: '0.725rem',
                              padding: '0.15rem 0.45rem',
                              fontFamily: 'var(--font-mono)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                            }}
                            title="Click to play audio at this timestamp"
                          >
                            <PlayCircle size={12} /> {timeLabel}
                          </button>
                        </div>
                        {segment.confidence !== undefined && (
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                            Conf: {Math.round(segment.confidence * 100)}%
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: '0.875rem', color: 'var(--text-main)', margin: 0, lineHeight: 1.45 }}>
                        {segment.text}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Decision Criteria */}
        {activeTab === 'criteria' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {(!insights?.decisionCriteria || insights.decisionCriteria.length === 0) ? (
              <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-dim)' }}>
                No explicit decision criteria were identified in this conversation.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1rem' }}>
                {insights.decisionCriteria.map((c, idx) => (
                  <div
                    key={idx}
                    className="card"
                    style={{
                      padding: '1.25rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem',
                      borderLeft:
                        c.importance === 'high'
                          ? '4px solid var(--danger)'
                          : c.importance === 'medium'
                          ? '4px solid var(--warning)'
                          : '4px solid var(--info)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.925rem', fontWeight: 700, color: 'var(--text-main)' }}>
                        {c.criterion}
                      </span>
                      <div style={{ display: 'flex', gap: '0.35rem' }}>
                        <Badge variant="neutral">{c.category}</Badge>
                        <Badge
                          variant={
                            c.importance === 'high'
                              ? 'danger'
                              : c.importance === 'medium'
                              ? 'warning'
                              : 'primary'
                          }
                        >
                          {c.importance}
                        </Badge>
                      </div>
                    </div>

                    {/* Verbatim Transcript Evidence */}
                    {c.evidence?.quote && (
                      <div
                        style={{
                          background: 'rgba(255, 255, 255, 0.02)',
                          padding: '0.65rem 0.85rem',
                          borderRadius: 'var(--radius-xs)',
                          borderLeft: '2px solid var(--border-light)',
                          fontSize: '0.8rem',
                          color: 'var(--text-muted)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 600, color: 'var(--accent-cyan)' }}>
                            <Quote size={12} /> Transcript Evidence
                          </span>
                          {c.evidence.startTime !== undefined && (
                            <button
                              onClick={() => handleSeek(c.evidence.startTime)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--primary)',
                                cursor: 'pointer',
                                fontSize: '0.725rem',
                                fontFamily: 'var(--font-mono)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.2rem',
                              }}
                            >
                              <PlayCircle size={12} /> Jump to audio
                            </button>
                          )}
                        </div>
                        <p style={{ margin: 0, fontStyle: 'italic' }}>"{c.evidence.quote}"</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Buying Signals */}
        {activeTab === 'signals' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {(!insights?.buyingSignals || insights.buyingSignals.length === 0) ? (
              <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-dim)' }}>
                No explicit buying signals recorded in this meeting.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1rem' }}>
                {insights.buyingSignals.map((signal, idx) => (
                  <div
                    key={idx}
                    className="card"
                    style={{
                      padding: '1.25rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem',
                      borderLeft: '4px solid var(--success)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.925rem', fontWeight: 700, color: 'var(--text-main)' }}>
                        {signal.signal}
                      </span>
                      <Badge variant="success">{signal.category.replace('_', ' ')}</Badge>
                    </div>

                    {/* Verbatim Transcript Evidence */}
                    {signal.evidence?.quote && (
                      <div
                        style={{
                          background: 'rgba(255, 255, 255, 0.02)',
                          padding: '0.65rem 0.85rem',
                          borderRadius: 'var(--radius-xs)',
                          borderLeft: '2px solid var(--border-light)',
                          fontSize: '0.8rem',
                          color: 'var(--text-muted)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 600, color: 'var(--accent-cyan)' }}>
                            <Quote size={12} /> Transcript Evidence
                          </span>
                          {signal.evidence.startTime !== undefined && (
                            <button
                              onClick={() => handleSeek(signal.evidence.startTime)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--primary)',
                                cursor: 'pointer',
                                fontSize: '0.725rem',
                                fontFamily: 'var(--font-mono)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.2rem',
                              }}
                            >
                              <PlayCircle size={12} /> Jump to audio
                            </button>
                          )}
                        </div>
                        <p style={{ margin: 0, fontStyle: 'italic' }}>"{signal.evidence.quote}"</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 5: Risks & Objections */}
        {activeTab === 'risks' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {(!insights?.objectionsAndRisks || insights.objectionsAndRisks.length === 0) ? (
              <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-dim)' }}>
                No active objections or risk factors were detected in this meeting.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1rem' }}>
                {insights.objectionsAndRisks.map((item, idx) => (
                  <div
                    key={idx}
                    className="card"
                    style={{
                      padding: '1.25rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem',
                      borderLeft:
                        item.severity === 'high'
                          ? '4px solid var(--danger)'
                          : item.severity === 'medium'
                          ? '4px solid var(--warning)'
                          : '4px solid var(--border-light)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.925rem', fontWeight: 700, color: 'var(--text-main)' }}>
                        {item.objection}
                      </span>
                      <div style={{ display: 'flex', gap: '0.35rem' }}>
                        <Badge variant="neutral">{item.category}</Badge>
                        <Badge
                          variant={
                            item.severity === 'high'
                              ? 'danger'
                              : item.severity === 'medium'
                              ? 'warning'
                              : 'primary'
                          }
                        >
                          {item.severity} severity
                        </Badge>
                      </div>
                    </div>

                    {item.mitigation && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        <strong style={{ color: 'var(--text-main)' }}>Suggested Mitigation: </strong>
                        {item.mitigation}
                      </div>
                    )}

                    {/* Verbatim Transcript Evidence */}
                    {item.evidence?.quote && (
                      <div
                        style={{
                          background: 'rgba(255, 255, 255, 0.02)',
                          padding: '0.65rem 0.85rem',
                          borderRadius: 'var(--radius-xs)',
                          borderLeft: '2px solid var(--border-light)',
                          fontSize: '0.8rem',
                          color: 'var(--text-muted)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 600, color: 'var(--accent-cyan)' }}>
                            <Quote size={12} /> Transcript Evidence
                          </span>
                          {item.evidence.startTime !== undefined && (
                            <button
                              onClick={() => handleSeek(item.evidence.startTime)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--primary)',
                                cursor: 'pointer',
                                fontSize: '0.725rem',
                                fontFamily: 'var(--font-mono)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.2rem',
                              }}
                            >
                              <PlayCircle size={12} /> Jump to audio
                            </button>
                          )}
                        </div>
                        <p style={{ margin: 0, fontStyle: 'italic' }}>"{item.evidence.quote}"</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 6: Competitor Intel */}
        {activeTab === 'competitors' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {(!insights?.competitors || insights.competitors.length === 0) ? (
              <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-dim)' }}>
                No competitor mentions identified in this recording.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1rem' }}>
                {insights.competitors.map((comp, idx) => (
                  <div
                    key={idx}
                    className="card"
                    style={{
                      padding: '1.25rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem',
                      borderLeft:
                        comp.displacementRisk === 'high'
                          ? '4px solid var(--danger)'
                          : comp.displacementRisk === 'medium'
                          ? '4px solid var(--warning)'
                          : '4px solid var(--primary)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)' }}>
                        {comp.competitorName}
                      </span>
                      <Badge
                        variant={
                          comp.displacementRisk === 'high'
                            ? 'danger'
                            : comp.displacementRisk === 'medium'
                            ? 'warning'
                            : 'neutral'
                        }
                      >
                        {comp.displacementRisk} risk
                      </Badge>
                    </div>

                    {comp.strengthsMentioned?.length > 0 && (
                      <div style={{ fontSize: '0.8rem' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Customer-Cited Strengths:</span>
                        <ul style={{ margin: '0.2rem 0 0 0', paddingLeft: '1.25rem', color: 'var(--text-main)' }}>
                          {comp.strengthsMentioned.map((s, sIdx) => (
                            <li key={sIdx}>{s}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {comp.weaknessesMentioned?.length > 0 && (
                      <div style={{ fontSize: '0.8rem' }}>
                        <span style={{ fontWeight: 600, color: 'var(--warning)' }}>Customer-Cited Pain Points / Weaknesses:</span>
                        <ul style={{ margin: '0.2rem 0 0 0', paddingLeft: '1.25rem', color: 'var(--text-main)' }}>
                          {comp.weaknessesMentioned.map((w, wIdx) => (
                            <li key={wIdx}>{w}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Transcript Evidence */}
                    {comp.evidence?.quote && (
                      <div
                        style={{
                          background: 'rgba(255, 255, 255, 0.02)',
                          padding: '0.65rem 0.85rem',
                          borderRadius: 'var(--radius-xs)',
                          borderLeft: '2px solid var(--border-light)',
                          fontSize: '0.8rem',
                          color: 'var(--text-muted)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 600, color: 'var(--accent-cyan)' }}>
                            <Quote size={12} /> Transcript Evidence
                          </span>
                          {comp.evidence.startTime !== undefined && (
                            <button
                              onClick={() => handleSeek(comp.evidence.startTime)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--primary)',
                                cursor: 'pointer',
                                fontSize: '0.725rem',
                                fontFamily: 'var(--font-mono)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.2rem',
                              }}
                            >
                              <PlayCircle size={12} /> Jump to audio
                            </button>
                          )}
                        </div>
                        <p style={{ margin: 0, fontStyle: 'italic' }}>"{comp.evidence.quote}"</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 7: Action Commitments */}
        {activeTab === 'actions' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {(!insights?.actionItems || insights.actionItems.length === 0) ? (
              <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-dim)' }}>
                No automated action items were generated from this conversation.
              </div>
            ) : (
              insights.actionItems.map((item, idx) => (
                <div
                  key={item._id || idx}
                  className="card"
                  style={{
                    padding: '1.25rem',
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: '1rem',
                    opacity: item.status === 'completed' ? 0.65 : 1,
                    borderLeft:
                      item.priority === 'urgent'
                        ? '4px solid var(--danger)'
                        : item.priority === 'high'
                        ? '4px solid var(--warning)'
                        : '4px solid var(--primary)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.85rem', flex: 1 }}>
                    {item._id && (
                      <button
                        onClick={() => handleActionToggle(item)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: item.status === 'completed' ? 'var(--success)' : 'var(--text-dim)',
                          cursor: 'pointer',
                          marginTop: '0.15rem',
                        }}
                        title="Toggle status"
                      >
                        <CheckCircle2 size={18} />
                      </button>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span
                          style={{
                            fontSize: '0.95rem',
                            fontWeight: 700,
                            color: 'var(--text-main)',
                            textDecoration: item.status === 'completed' ? 'line-through' : 'none',
                          }}
                        >
                          {item.title}
                        </span>

                        <Badge variant={item.responsibleParty === 'customer' ? 'warning' : 'primary'}>
                          {item.responsibleParty === 'customer' ? 'Customer Deliverable' : 'Internal Action'}
                        </Badge>

                        <Badge
                          variant={
                            item.priority === 'urgent'
                              ? 'danger'
                              : item.priority === 'high'
                              ? 'warning'
                              : 'neutral'
                          }
                        >
                          {item.priority}
                        </Badge>
                      </div>

                      {item.description && (
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
                          {item.description}
                        </p>
                      )}

                      {/* Verbatim Transcript Evidence */}
                      {item.evidence?.quote && (
                        <div
                          style={{
                            background: 'rgba(255, 255, 255, 0.02)',
                            padding: '0.45rem 0.75rem',
                            borderRadius: 'var(--radius-xs)',
                            borderLeft: '2px solid var(--border-light)',
                            fontSize: '0.785rem',
                            color: 'var(--text-muted)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <Quote size={11} style={{ color: 'var(--accent-cyan)' }} />
                            <span style={{ fontStyle: 'italic' }}>"{item.evidence.quote}"</span>
                          </div>
                          {item.evidence.startTime !== undefined && (
                            <button
                              onClick={() => handleSeek(item.evidence.startTime)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--primary)',
                                cursor: 'pointer',
                                fontSize: '0.725rem',
                                fontFamily: 'var(--font-mono)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.2rem',
                              }}
                            >
                              <PlayCircle size={11} /> Jump
                            </button>
                          )}
                        </div>
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.15rem' }}>
                        {item.dueDate && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <Calendar size={12} />
                            Due: {new Date(item.dueDate).toLocaleDateString()}
                          </div>
                        )}
                        {item.assignedTo && <span>Assigned: {item.assignedTo}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Human Review Modal */}
      <ReviewInsightsModal
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        meetingId={meeting._id}
        currentInsights={insights}
        onSaved={(updated) => {
          setInsights(updated);
          loadMeetingData(true);
        }}
      />
    </div>
  );
};

export default MeetingDetailsPage;
