import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Mic,
  Plus,
  Search,
  Filter,
  Eye,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  RefreshCw,
  UploadCloud,
  FileAudio,
} from 'lucide-react';
import ApiClient from '../services/api';
import Badge from '../components/common/Badge';
import Modal from '../components/common/Modal';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import AudioUploadModal from '../components/meetings/AudioUploadModal';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

const MeetingsPage = () => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();

  const [meetings, setMeetings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [platform, setPlatform] = useState('');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [modalInitialTab, setModalInitialTab] = useState('file');
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);

  // Form State for manual note entry
  const [form, setForm] = useState({
    title: '',
    clientName: '',
    clientEmail: '',
    platform: 'google_meet',
    durationMinutes: 30,
    overview: '',
  });
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const fetchMeetings = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const res = await ApiClient.get('/meetings', { search, platform });
      if (res.success && res.data) {
        setMeetings(res.data.meetings || []);
      }
    } catch (err) {
      console.error('Fetch meetings failed:', err);
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMeetings();
  }, [platform]);

  // Real-time updates via Socket.IO
  useEffect(() => {
    if (!socket) return;

    const handleStatus = (data) => {
      fetchMeetings(true);
    };

    socket.on('meeting:status', handleStatus);
    return () => {
      socket.off('meeting:status', handleStatus);
    };
  }, [socket]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchMeetings();
  };

  const handleManualCreateMeeting = async (e) => {
    e.preventDefault();
    setFormSubmitting(true);
    setFormError('');

    try {
      const payload = {
        title: form.title,
        clientName: form.clientName,
        clientEmail: form.clientEmail,
        platform: form.platform,
        durationMinutes: Number(form.durationMinutes),
        summary: {
          overview: form.overview,
          sentiment: 'positive',
          keyPoints: ['Manual discovery entry', 'Customer requirements logged'],
          objections: [],
          nextSteps: ['Follow up with proposal'],
        },
        rawTranscript: `[00:01] Rep: Welcome to the call.\n[00:05] Client: Looking forward to discussing DealFlow AI.`,
      };

      const res = await ApiClient.post('/meetings', payload);
      if (res.success && res.data?.meeting) {
        setIsLogModalOpen(false);
        setForm({
          title: '',
          clientName: '',
          clientEmail: '',
          platform: 'google_meet',
          durationMinutes: 30,
          overview: '',
        });
        fetchMeetings();
      }
    } catch (err) {
      setFormError(err.message || 'Failed to log meeting.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDeleteMeeting = async (meetingId, e) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this meeting record?')) return;
    try {
      await ApiClient.delete(`/meetings/${meetingId}`);
      fetchMeetings(true);
    } catch (err) {
      alert(err.message || 'Failed to delete meeting.');
    }
  };

  const handleUploadSuccess = (createdMeeting) => {
    setIsUploadModalOpen(false);
    if (createdMeeting?._id) {
      navigate(`/meetings/${createdMeeting._id}`);
    } else {
      fetchMeetings();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div className="page-header-container">
        <div>
          <h2 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em', margin: 0 }}>
            Voice Meetings & Intelligence
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            Upload customer call recordings, generate Whisper transcripts, and inspect AI-extracted deal insights
          </p>
        </div>

        <div className="page-header-actions">
          <button onClick={() => setIsLogModalOpen(true)} className="btn btn-secondary">
            <Plus size={16} /> Log Call Note
          </button>
          <button
            onClick={() => {
              setModalInitialTab('record');
              setIsUploadModalOpen(true);
            }}
            className="btn btn-secondary"
            title="Record directly from microphone"
          >
            <Mic size={16} /> Record Audio
          </button>
          <button
            onClick={() => {
              setModalInitialTab('file');
              setIsUploadModalOpen(true);
            }}
            className="btn btn-primary"
          >
            <UploadCloud size={16} /> Upload Recording
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="card filter-toolbar">
        <form onSubmit={handleSearchSubmit} className="filter-search">
          <Search size={16} className="filter-group-icon" />
          <input
            type="text"
            placeholder="Search meetings by title or client account..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </form>

        <div className="filter-group has-icon">
          <Filter size={16} className="filter-group-icon" />
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className="filter-select"
            aria-label="Filter by platform"
          >
            <option value="">All Platforms</option>
            <option value="upload">Audio Upload</option>
            <option value="google_meet">Google Meet</option>
            <option value="zoom">Zoom</option>
            <option value="teams">Microsoft Teams</option>
            <option value="phone">Phone / Cellular</option>
          </select>
        </div>

        <div className="filter-actions">
          <button onClick={() => fetchMeetings()} className="btn btn-secondary btn-sm" title="Refresh">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Meetings Table */}
      {isLoading ? (
        <div style={{ padding: '4rem', display: 'flex', justifyContent: 'center' }}>
          <LoadingSpinner size="lg" message="Loading voice meetings from database..." />
        </div>
      ) : meetings.length === 0 ? (
        <EmptyState
          icon={Mic}
          title="No voice meetings found"
          description={search ? 'No results matched your search criteria.' : 'Upload your first customer call recording to extract deal intelligence.'}
          actionLabel="Upload Audio Recording"
          onAction={() => setIsUploadModalOpen(true)}
        />
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Conversation Title</th>
                <th>Client Account</th>
                <th>Source</th>
                <th>Duration</th>
                <th>Transcription</th>
                <th>AI Intelligence</th>
                <th>CRM Sync</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {meetings.map((m) => {
                const hasAudio = m.audioStorage?.stored;
                return (
                  <tr
                    key={m._id}
                    onClick={() => navigate(`/meetings/${m._id}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                          {hasAudio && <FileAudio size={15} style={{ color: 'var(--primary)', flexShrink: 0 }} />}
                          <strong style={{ fontSize: '0.925rem' }}>{m.title}</strong>
                          {(m.sourceMetadata?.isDemo || m.sourceMetadata?.isSeed || m.title?.includes('Technical Architecture Review')) && (
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
                                padding: '0.1rem 0.4rem',
                              }}
                            >
                              Demo Data
                            </span>
                          )}
                        </div>
                        {m.dealId && (
                          <p style={{ fontSize: '0.75rem', color: 'var(--primary)', marginTop: '0.15rem' }}>
                            Deal: {m.dealId.name} (${m.dealId.amount?.toLocaleString()})
                          </p>
                        )}
                      </div>
                    </td>
                    <td>
                      <div>
                        <span style={{ fontWeight: 600 }}>{m.clientName}</span>
                        {m.clientEmail && <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{m.clientEmail}</p>}
                      </div>
                    </td>
                    <td>
                      <Badge variant="neutral">
                        {hasAudio ? 'Audio Upload' : m.platform.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        <Clock size={13} /> {m.durationMinutes || 0}m
                      </div>
                    </td>
                    <td>
                      <Badge
                        variant={
                          m.transcriptionStatus === 'completed'
                            ? 'success'
                            : m.transcriptionStatus === 'processing'
                            ? 'primary'
                            : m.transcriptionStatus === 'failed'
                            ? 'danger'
                            : 'neutral'
                        }
                      >
                        {m.transcriptionStatus}
                      </Badge>
                    </td>
                    <td>
                      <Badge
                        variant={
                          m.analysisStatus === 'completed'
                            ? 'success'
                            : m.analysisStatus === 'processing'
                            ? 'primary'
                            : m.analysisStatus === 'failed'
                            ? 'danger'
                            : 'neutral'
                        }
                      >
                        {m.analysisStatus}
                      </Badge>
                    </td>
                    <td>
                      <Badge variant={m.crmSyncStatus === 'synced' ? 'success' : 'warning'}>
                        {m.crmSyncStatus.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                        <Link
                          to={`/meetings/${m._id}`}
                          className="btn btn-secondary btn-sm"
                          title="Open meeting workspace"
                        >
                          <Eye size={14} /> Intelligence
                        </Link>

                        {['admin', 'manager'].includes(user?.role) && (
                          <button
                            onClick={(e) => handleDeleteMeeting(m._id, e)}
                            className="btn btn-danger btn-sm"
                            title="Delete meeting"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Audio Upload Modal */}
      <AudioUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onSuccess={handleUploadSuccess}
        initialTab={modalInitialTab}
      />

      {/* Manual Meeting Log Modal */}
      <Modal isOpen={isLogModalOpen} onClose={() => setIsLogModalOpen(false)} title="Log Customer Meeting Note">
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

        <form onSubmit={handleManualCreateMeeting} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
              Meeting Title *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Q4 Executive Demo & Security Review"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                Client / Account *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Acme Corp"
                value={form.clientName}
                onChange={(e) => setForm({ ...form, clientName: e.target.value })}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                Client Email
              </label>
              <input
                type="email"
                placeholder="contact@client.com"
                value={form.clientEmail}
                onChange={(e) => setForm({ ...form, clientEmail: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                Platform Source
              </label>
              <select value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })}>
                <option value="google_meet">Google Meet</option>
                <option value="zoom">Zoom</option>
                <option value="teams">Microsoft Teams</option>
                <option value="phone">Phone Call</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                Duration (minutes)
              </label>
              <input
                type="number"
                min="5"
                max="240"
                value={form.durationMinutes}
                onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
              Executive Call Summary / Notes
            </label>
            <textarea
              rows="3"
              placeholder="Key topics discussed, client reactions, and agreements..."
              value={form.overview}
              onChange={(e) => setForm({ ...form, overview: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button type="button" onClick={() => setIsLogModalOpen(false)} className="btn btn-secondary btn-sm">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={formSubmitting}>
              {formSubmitting ? 'Saving...' : 'Save Call Note'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default MeetingsPage;
