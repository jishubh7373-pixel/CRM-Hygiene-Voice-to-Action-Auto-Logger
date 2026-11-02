import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  Square,
  Pause,
  Play,
  RotateCcw,
  UploadCloud,
  AlertCircle,
  CheckCircle2,
  Volume2,
  DollarSign,
  Radio,
} from 'lucide-react';
import ApiClient from '../../services/api';

const formatSeconds = (totalSec) => {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
};

const LiveAudioRecorder = ({ onSuccess, onCancel, deals = [] }) => {
  // Recorder states: 'idle' | 'recording' | 'paused' | 'stopped'
  const [recorderState, setRecorderState] = useState('idle');
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [audioMimeType, setAudioMimeType] = useState('audio/webm');
  const [errorMessage, setErrorMessage] = useState('');

  // Metadata form
  const [title, setTitle] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [dealId, setDealId] = useState('');
  const [scheduledStartTime, setScheduledStartTime] = useState(
    new Date().toISOString().slice(0, 16)
  );

  // Upload state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatusText, setUploadStatusText] = useState('');

  // Refs
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);
  const timerIntervalRef = useRef(null);

  // Clean up media streams and object URLs on unmount
  useEffect(() => {
    return () => {
      cleanupResources();
    };
  }, []);

  const cleanupResources = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
  };

  const startRecording = async () => {
    setErrorMessage('');
    if (!navigator.mediaDevices || !window.MediaRecorder) {
      setErrorMessage(
        'In-browser voice recording is not supported in this browser. Please use modern Chrome, Firefox, or Edge.'
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        },
      });
      streamRef.current = stream;

      // Determine best supported MIME type
      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        if (MediaRecorder.isTypeSupported('audio/webm')) {
          mimeType = 'audio/webm';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        } else {
          mimeType = '';
        }
      }
      setAudioMimeType(mimeType || 'audio/webm');

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const finalBlob = new Blob(audioChunksRef.current, {
          type: mimeType || 'audio/webm',
        });
        if (finalBlob.size < 500) {
          setErrorMessage('Recorded audio is too short or empty. Please record for at least a few seconds.');
          setRecorderState('idle');
          return;
        }
        setAudioBlob(finalBlob);
        const url = URL.createObjectURL(finalBlob);
        setAudioUrl(url);
        setRecorderState('stopped');

        if (!title) {
          const defaultTitle = `Call Recording - ${new Date().toLocaleDateString()}`;
          setTitle(defaultTitle);
        }
      };

      recorder.start(1000); // 1-second timeslices
      setRecorderState('recording');
      setRecordingDuration(0);

      timerIntervalRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMessage('Microphone access was denied. Please allow microphone permissions in your browser to record.');
      } else if (err.name === 'NotFoundError') {
        setErrorMessage('No microphone device was detected on your computer.');
      } else {
        setErrorMessage(`Failed to start microphone recording: ${err.message}`);
      }
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && recorderState === 'recording') {
      mediaRecorderRef.current.pause();
      setRecorderState('paused');
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && recorderState === 'paused') {
      mediaRecorderRef.current.resume();
      setRecorderState('recording');
      timerIntervalRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && (recorderState === 'recording' || recorderState === 'paused')) {
      mediaRecorderRef.current.stop();
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    }
  };

  const resetRecording = () => {
    cleanupResources();
    setRecorderState('idle');
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingDuration(0);
    setErrorMessage('');
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!audioBlob) {
      setErrorMessage('No recorded audio available to upload.');
      return;
    }
    if (!title.trim()) {
      setErrorMessage('Meeting title is required.');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setUploadStatusText('Packaging audio and uploading...');

    try {
      // Determine file extension
      const ext = audioMimeType.includes('mp4') ? 'mp4' : 'webm';
      const filename = `mic_recording_${Date.now()}.${ext}`;
      const audioFile = new File([audioBlob], filename, {
        type: audioMimeType || 'audio/webm',
      });

      const formData = new FormData();
      formData.append('audio', audioFile);
      formData.append('title', title.trim());
      formData.append('clientName', clientName.trim() || 'Recorded Client Call');
      if (clientEmail.trim()) formData.append('clientEmail', clientEmail.trim());
      if (dealId) formData.append('dealId', dealId);
      if (scheduledStartTime) formData.append('scheduledStartTime', scheduledStartTime);

      const response = await ApiClient.upload('/meetings/upload', formData, (percent) => {
        setUploadProgress(percent);
        if (percent === 100) {
          setUploadStatusText('Transcribing & queuing AI intelligence pipeline...');
        }
      });

      if (response.success && response.data?.meeting) {
        setUploadStatusText('Recording queued successfully!');
        resetRecording();
        if (onSuccess) {
          onSuccess(response.data.meeting);
        }
      } else {
        throw new Error(response.message || 'Upload failed');
      }
    } catch (err) {
      setErrorMessage(err.message || 'Failed to upload recorded meeting.');
      setIsUploading(false);
      setUploadProgress(0);
      setUploadStatusText('');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {errorMessage && (
        <div
          style={{
            padding: '0.75rem 1rem',
            background: 'var(--danger-subtle)',
            border: '1px solid var(--danger-border)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--danger)',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Recording Visual Stage */}
      <div
        style={{
          border: '1px solid var(--border-light)',
          borderRadius: 'var(--radius-md)',
          background: 'rgba(255, 255, 255, 0.02)',
          padding: '2rem 1rem',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
        }}
      >
        {recorderState === 'idle' && (
          <>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'var(--primary-subtle)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Mic size={32} />
            </div>
            <div>
              <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)' }}>
                Direct Microphone Recording
              </h4>
              <p style={{ margin: '0.35rem 0 0', fontSize: '0.825rem', color: 'var(--text-muted)' }}>
                Click below to start recording high-fidelity audio from your browser.
              </p>
            </div>
            <button
              type="button"
              onClick={startRecording}
              className="btn btn-primary"
              style={{ gap: '0.5rem', padding: '0.65rem 1.5rem', marginTop: '0.5rem' }}
            >
              <Mic size={16} /> Start Recording
            </button>
          </>
        )}

        {(recorderState === 'recording' || recorderState === 'paused') && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div
                style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  background: recorderState === 'recording' ? 'var(--danger)' : 'var(--warning)',
                  boxShadow: recorderState === 'recording' ? '0 0 12px var(--danger)' : 'none',
                  animation: recorderState === 'recording' ? 'pulse 1.5s infinite' : 'none',
                }}
              />
              <span
                style={{
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: recorderState === 'recording' ? 'var(--danger)' : 'var(--warning)',
                }}
              >
                {recorderState === 'recording' ? 'Live Recording' : 'Recording Paused'}
              </span>
            </div>

            <div
              style={{
                fontSize: '2.5rem',
                fontWeight: 800,
                letterSpacing: '-0.02em',
                fontVariantNumeric: 'tabular-nums',
                color: 'var(--text-main)',
              }}
            >
              {formatSeconds(recordingDuration)}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem' }}>
              {recorderState === 'recording' ? (
                <button
                  type="button"
                  onClick={pauseRecording}
                  className="btn btn-secondary btn-sm"
                  style={{ gap: '0.4rem' }}
                >
                  <Pause size={14} /> Pause
                </button>
              ) : (
                <button
                  type="button"
                  onClick={resumeRecording}
                  className="btn btn-secondary btn-sm"
                  style={{ gap: '0.4rem' }}
                >
                  <Play size={14} /> Resume
                </button>
              )}
              <button
                type="button"
                onClick={stopRecording}
                className="btn btn-danger btn-sm"
                style={{ gap: '0.4rem' }}
              >
                <Square size={14} /> Stop Recording
              </button>
            </div>
          </>
        )}

        {recorderState === 'stopped' && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--success)' }}>
              <CheckCircle2 size={18} />
              <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                Recording Ready ({formatSeconds(recordingDuration)})
              </span>
            </div>

            {audioUrl && (
              <audio
                controls
                src={audioUrl}
                style={{
                  width: '100%',
                  maxWidth: '420px',
                  borderRadius: 'var(--radius-sm)',
                  outline: 'none',
                }}
              />
            )}

            <button
              type="button"
              onClick={resetRecording}
              className="btn btn-secondary btn-sm"
              style={{ gap: '0.4rem' }}
            >
              <RotateCcw size={13} /> Re-record Audio
            </button>
          </div>
        )}
      </div>

      {/* Metadata Form & Submit (Enabled after recording stops) */}
      {recorderState === 'stopped' && (
        <form onSubmit={handleUpload} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
              Meeting Title *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Enterprise Solution Scoping Call"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="form-input"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                Client / Account Name
              </label>
              <input
                type="text"
                placeholder="e.g. Acme Corp"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="form-input"
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                Client Contact Email
              </label>
              <input
                type="email"
                placeholder="buyer@client.com"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                className="form-input"
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                Link to CRM Deal
              </label>
              <select
                value={dealId}
                onChange={(e) => setDealId(e.target.value)}
                className="form-input"
              >
                <option value="">-- No deal linked --</option>
                {deals.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.name} (${(d.amount || d.value || 0).toLocaleString()})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                Date & Time
              </label>
              <input
                type="datetime-local"
                value={scheduledStartTime}
                onChange={(e) => setScheduledStartTime(e.target.value)}
                className="form-input"
              />
            </div>
          </div>

          {/* Upload Progress */}
          {isUploading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                <span>{uploadStatusText}</span>
                <span>{uploadProgress}%</span>
              </div>
              <div
                style={{
                  height: '6px',
                  background: 'var(--border-light)',
                  borderRadius: '3px',
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

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.75rem' }}>
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                disabled={isUploading}
                className="btn btn-secondary"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={isUploading || !audioBlob || !title.trim()}
              className="btn btn-primary"
              style={{ gap: '0.5rem' }}
            >
              <UploadCloud size={16} />
              {isUploading ? 'Uploading & Processing...' : 'Save & Process Recording'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default LiveAudioRecorder;
