const config = require('../../../config');
const gongAuth = require('./gong.auth');
const integrationsService = require('../integrations.service');
const unifiedMeetingIngestion = require('../../../services/unifiedMeetingIngestion.service');
const AppError = require('../../../utils/appError');
const logger = require('../../../utils/logger');

class GongImportService {
  /**
   * Fetch calls with optional date filters and pagination cursor
   */
  async fetchCalls({ accessKey, clientSecret, fromDateTime, toDateTime, cursor = undefined, limit = 50, baseUrl = null }) {
    const apiBase = baseUrl || config.integrations.gong.baseUrl || 'https://api.gong.io';
    const authHeader = gongAuth.getAuthHeader(accessKey, clientSecret);

    const params = new URLSearchParams();
    if (fromDateTime) params.set('fromDateTime', new Date(fromDateTime).toISOString());
    if (toDateTime) params.set('toDateTime', new Date(toDateTime).toISOString());
    if (cursor) params.set('cursor', cursor);

    const url = `${apiBase}/v2/calls?${params.toString()}`;
    const res = await fetch(url, {
      headers: {
        Authorization: authHeader,
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      logger.error(`Gong call listing failed (${res.status}): ${errText}`);
      throw new AppError(`Gong API error: ${res.statusText}`, res.status, 'GONG_API_ERROR');
    }

    return res.json();
  }

  /**
   * Fetch transcripts for specific call IDs
   */
  async fetchTranscripts({ accessKey, clientSecret, callIds = [], baseUrl = null }) {
    if (!callIds.length) return { callTranscripts: [] };

    const apiBase = baseUrl || config.integrations.gong.baseUrl || 'https://api.gong.io';
    const authHeader = gongAuth.getAuthHeader(accessKey, clientSecret);

    const res = await fetch(`${apiBase}/v2/calls/transcript`, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        filter: {
          callIds,
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      logger.error(`Gong transcript fetch failed (${res.status}): ${errText}`);
      throw new AppError(`Gong transcript error: ${res.statusText}`, res.status, 'GONG_TRANSCRIPT_ERROR');
    }

    return res.json();
  }

  /**
   * Normalize Gong monologues into standard transcript segments
   */
  normalizeTranscript(transcriptObj) {
    if (!transcriptObj || !Array.isArray(transcriptObj.transcript)) {
      return [];
    }

    const segments = [];
    transcriptObj.transcript.forEach((monologue) => {
      const speaker = monologue.speakerId ? `Speaker ${monologue.speakerId}` : 'Speaker';
      if (Array.isArray(monologue.sentences)) {
        monologue.sentences.forEach((sentence) => {
          segments.push({
            speaker,
            text: sentence.text || '',
            startTime: (sentence.start || 0) / 1000, // Convert ms to seconds
            endTime: (sentence.end || 0) / 1000,
            confidence: 0.95,
          });
        });
      }
    });

    return segments;
  }

  /**
   * Complete Gong import pipeline feeding UnifiedMeetingIngestion
   */
  async importCalls({ organizationId, userId = null, fromDateTime = null, toDateTime = null, maxCalls = 50 }) {
    logger.info(`[Gong Import] Starting import for org ${organizationId}...`);

    try {
      const creds = await integrationsService.getDecryptedCredentials(organizationId, 'gong');
      if (!creds || !creds.accessKey || !creds.clientSecret) {
        throw new AppError('Gong is not configured or credentials missing', 400, 'GONG_NOT_CONFIGURED');
      }

      const callsResponse = await this.fetchCalls({
        accessKey: creds.accessKey,
        clientSecret: creds.clientSecret,
        fromDateTime,
        toDateTime,
        baseUrl: creds.baseUrl,
      });

      const calls = callsResponse.calls || [];
      if (!calls.length) {
        await integrationsService.recordSuccess(organizationId, 'gong', { importedCount: 0, duplicateCount: 0 });
        return { importedCount: 0, duplicateCount: 0, totalFound: 0 };
      }

      const callIds = calls.slice(0, maxCalls).map((c) => c.id);

      // Fetch transcripts in bulk
      let transcriptsMap = new Map();
      try {
        const transcriptRes = await this.fetchTranscripts({
          accessKey: creds.accessKey,
          clientSecret: creds.clientSecret,
          callIds,
          baseUrl: creds.baseUrl,
        });
        (transcriptRes.callTranscripts || []).forEach((t) => {
          transcriptsMap.set(t.callId, t);
        });
      } catch (tErr) {
        logger.warn(`[Gong Import] Could not fetch transcripts: ${tErr.message}`);
      }

      let importedCount = 0;
      let duplicateCount = 0;

      for (const call of calls.slice(0, maxCalls)) {
        const meta = call.metaData || {};
        const title = meta.title || `Gong Call #${call.id}`;
        const meetingDate = meta.started ? new Date(meta.started) : new Date();
        const duration = meta.duration || 0;
        const durationMinutes = Math.ceil(duration / 60) || 30;

        const parties = call.parties || [];
        const externalParty = parties.find((p) => p.affiliation === 'external');
        const clientName = externalParty ? (externalParty.name || externalParty.email || 'Customer') : 'Gong Customer';
        const clientEmail = externalParty?.email || undefined;

        const transcriptData = transcriptsMap.get(call.id);
        const transcriptSegments = transcriptData ? this.normalizeTranscript(transcriptData) : [];

        const ingestResult = await unifiedMeetingIngestion.ingestMeeting({
          organizationId,
          source: 'gong',
          externalProvider: 'gong',
          externalCallId: call.id,
          title,
          description: `Imported from Gong. Call ID: ${call.id}. Direction: ${meta.direction || 'Inbound/Outbound'}`,
          clientName,
          clientEmail,
          meetingDate,
          duration,
          durationMinutes,
          uploadedBy: userId,
          sourceMetadata: {
            gongCallId: call.id,
            url: call.url || meta.url,
            language: meta.language,
            direction: meta.direction,
          },
          transcriptSegments,
        });

        if (ingestResult.isDuplicate) {
          duplicateCount++;
        } else {
          importedCount++;
        }
      }

      await integrationsService.recordSuccess(organizationId, 'gong', {
        lastSyncTotal: calls.length,
        importedCount,
        duplicateCount,
      });

      logger.info(`[Gong Import] Import complete for org ${organizationId}: ${importedCount} new, ${duplicateCount} duplicates.`);

      return {
        success: true,
        totalFound: calls.length,
        importedCount,
        duplicateCount,
      };
    } catch (err) {
      await integrationsService.recordError(organizationId, 'gong', err);
      throw err;
    }
  }
}

module.exports = new GongImportService();
