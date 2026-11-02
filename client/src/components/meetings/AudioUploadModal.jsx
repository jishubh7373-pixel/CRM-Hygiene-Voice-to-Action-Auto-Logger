import React, { useState, useEffect, useRef } from 'react';
import { UploadCloud, FileAudio, X, AlertCircle, CheckCircle2, DollarSign, Mic } from 'lucide-react';
import ApiClient from '../../services/api';
import Modal from '../common/Modal';
import LiveAudioRecorder from './LiveAudioRecorder';

const ALLOWED_EXTENSIONS = ['.mp3', '.wav', '.m4a', '.mp4'];
const MAX_FILE_SIZE_MB = 25;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const AudioUploadModal = ({ isOpen, onClose, onSuccess, initialTab = 'file' }) => {
  const fileInputRef = useRef(null);
  const [activeTab, setActiveTab] = useState(initialTab || 'file');
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [deals, setDeals] = useState([]);
  const [title, setTitle] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [dealId, setDealId] = useState('');
  const [scheduledStartTime, setScheduledStartTime] = useState(
    new Date().toISOString().slice(0, 16)
  );

  const [uploadProgress, setUploadProgress] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [uploadStatusText, setUploadStatusText] = useState('');

  // Fetch active deals for optional association
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab || 'file');
      ApiClient.get('/deals')
        .then((res) => {
          if (res.success && res.data?.deals) {
            setDeals(res.data.deals);
          }
        })
        .catch(() => {});
    }
  }, [isOpen, initialTab]);

  const validateFile = (selectedFile) => {
    if (!selectedFile) return 'Please select an audio recording.';

    const ext = '.' + selectedFile.name.split('.').pop().toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return `Unsupported file format (${ext}). Supported formats are: ${ALLOWED_EXTENSIONS.join(', ')}`;
    }

    if (selectedFile.size > MAX_FILE_SIZE_BYTES) {
      return `File size (${(selectedFile.size / (1024 * 1024)).toFixed(1)} MB) exceeds maximum allowed limit of ${MAX_FILE_SIZE_MB} MB.`;
    }

    return null;
  };

  const handleFileSelect = (selectedFile) => {
    setErrorMessage('');
    const validationError = validateFile(selectedFile);
    if (validationError) {
      setErrorMessage(validationError);
      setFile(null);
      return;
    }

    setFile(selectedFile);
    if (!title) {
      // Auto-suggest title based on filename
      const baseName = selectedFile.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      setTitle(baseName.charAt(0).toUpperCase() + baseName.slice(1));
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const resetForm = () => {
    setFile(null);
    setTitle('');
    setClientName('');
    setClientEmail('');
    setDealId('');
    setUploadProgress(0);
    setIsSubmitting(false);
    setErrorMessage('');
    setUploadStatusText('');
  };

  const handleClose = () => {
    if (isSubmitting) return;
    resetForm();
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!file) {
      setErrorMessage('Please select or drop an audio file.');
      return;
    }

    if (!title.trim()) {
      setErrorMessage('Meeting title is required.');
      return;
    }

    setIsSubmitting(true);
    setUploadProgress(0);
    setUploadStatusText('Uploading audio file...');

    try {
      const formData = new FormData();
      formData.append('audio', file);
      formData.append('title', title.trim());
      formData.append('clientName', clientName.trim() || 'Prospective Client');
      if (clientEmail.trim()) formData.append('clientEmail', clientEmail.trim());
      if (dealId) formData.append('dealId', dealId);
      if (scheduledStartTime) formData.append('scheduledStartTime', scheduledStartTime);

      const response = await ApiClient.upload('/meetings/upload', formData, (percent) => {
        setUploadProgress(percent);
        if (percent === 100) {
          setUploadStatusText('Transcribing & queuing intelligence engine...');
        }
      });

      if (response.success && response.data?.meeting) {
        setUploadStatusText('Meeting queued successfully!');
        resetForm();
        if (onSuccess) {
          onSuccess(response.data.meeting);
        }
      } else {
        throw new Error(response.message || 'Upload failed');
      }
    } catch (err) {
      setErrorMessage(err.message || 'Failed to upload audio meeting.');
      setIsSubmitting(false);
      setUploadProgress(0);
      setUploadStatusText('');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Ingest Voice Meeting Recording" maxWidth={580}>
      {/* Mode Switcher Tabs */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid var(--border-light)',
          marginBottom: '1.25rem',
          gap: '0.5rem',
        }}
      >
        <button
          type="button"
          onClick={() => {
            setActiveTab('file');
            setErrorMessage('');
          }}
          style={{
            flex: 1,
            padding: '0.65rem 1rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'file' ? '2px solid var(--primary)' : '2px solid transparent',
            color: activeTab === 'file' ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: 600,
            fontSize: '0.875rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.45rem',
            transition: 'all 0.15s ease',
          }}
        >
          <UploadCloud size={16} /> Upload Audio File
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab('record');
            setErrorMessage('');
          }}
          style={{
            flex: 1,
            padding: '0.65rem 1rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'record' ? '2px solid var(--primary)' : '2px solid transparent',
            color: activeTab === 'record' ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: 600,
            fontSize: '0.875rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.45rem',
            transition: 'all 0.15s ease',
          }}
        >
          <Mic size={16} /> Direct Microphone Record
        </button>
      </div>

      {activeTab === 'record' ? (
        <LiveAudioRecorder
          deals={deals}
          onSuccess={(meeting) => {
            handleClose();
            if (onSuccess) onSuccess(meeting);
          }}
          onCancel={handleClose}
        />
      ) : (
        <>
          {errorMessage && (
            <div
              style={{
                padding: '0.75rem 1rem',
                background: 'var(--danger-subtle)',
                border: '1px solid var(--danger-border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--danger)',
                fontSize: '0.85rem',
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
        {/* Drag and Drop Zone */}
        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
            Audio Recording File *
          </label>
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: isDragging ? '2px dashed var(--primary)' : '2px dashed var(--border-light)',
              borderRadius: 'var(--radius-md)',
              background: isDragging ? 'var(--primary-subtle)' : 'rgba(255, 255, 255, 0.02)',
              padding: '1.75rem 1rem',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".mp3,.wav,.m4a,.mp4,audio/*"
              style={{ display: 'none' }}
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileSelect(e.target.files[0]);
                }
              }}
            />

            {file ? (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  background: 'rgba(255, 255, 255, 0.05)',
                  padding: '0.6rem 1rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-light)',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <FileAudio size={24} style={{ color: 'var(--primary)' }} />
                <div style={{ textAlign: 'left' }}>
                  <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-main)', margin: 0 }}>
                    {file.name}
                  </p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', margin: 0 }}>
                    {(file.size / (1024 * 1024)).toFixed(2)} MB &bull; {file.type || 'audio file'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-dim)',
                    cursor: 'pointer',
                    padding: '0.2rem',
                    marginLeft: '0.5rem',
                  }}
                  title="Remove file"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem' }}>
                <UploadCloud size={32} style={{ color: 'var(--primary)', marginBottom: '0.2rem' }} />
                <p style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)', margin: 0 }}>
                  Click to browse or drag & drop audio
                </p>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
                  MP3, WAV, M4A, or MP4 audio &bull; Max {MAX_FILE_SIZE_MB}MB
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Meeting Title */}
        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
            Meeting Title *
          </label>
          <input
            type="text"
            required
            placeholder="e.g. Acme Corp Technical Architecture & Procurement Review"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        {/* Client & Email */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
              Client / Account Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Acme Corp"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
              Client Email (Optional)
            </label>
            <input
              type="email"
              placeholder="lead@acmecorp.com"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
            />
          </div>
        </div>

        {/* Associate Deal & Date */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
              Associate with CRM Deal (Optional)
            </label>
            <select value={dealId} onChange={(e) => setDealId(e.target.value)}>
              <option value="">-- No Deal Linked --</option>
              {deals.map((d) => (
                <option key={d._id} value={d._id}>
                  {d.name} (${d.amount?.toLocaleString()})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
              Meeting Date & Time
            </label>
            <input
              type="datetime-local"
              value={scheduledStartTime}
              onChange={(e) => setScheduledStartTime(e.target.value)}
            />
          </div>
        </div>

        {/* Upload Progress Bar */}
        {isSubmitting && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.785rem', color: 'var(--text-muted)' }}>
              <span>{uploadStatusText}</span>
              <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{uploadProgress}%</span>
            </div>
            <div
              style={{
                width: '100%',
                height: '6px',
                background: 'rgba(255, 255, 255, 0.08)',
                borderRadius: 'var(--radius-full)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${uploadProgress}%`,
                  background: 'var(--primary)',
                  transition: 'width 0.2s ease',
                }}
              />
            </div>
          </div>
        )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button type="button" onClick={handleClose} className="btn btn-secondary btn-sm" disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={isSubmitting || !file}>
              {isSubmitting ? 'Uploading & Processing...' : 'Upload & Run AI Pipeline'}
            </button>
          </div>
        </form>
      </>
    )}
  </Modal>
  );
};

export default AudioUploadModal;
