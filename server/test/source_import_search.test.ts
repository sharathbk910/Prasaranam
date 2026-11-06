import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { db } from '../src/db/store.js';
import { splitIntoVerifiableChunks } from '../src/services/sourceImporter.js';

describe('Phase 2: Authorised Source Import & Permissions-Filtered Search', () => {
  beforeEach(() => {
    db.resetToSeed();
  });

  describe('Chunk Offsets Exact Invariant', () => {
    it('verifies chunk offsets reproduce the original text exactly', () => {
      const sampleText = `Autonomous Battery Inverter Configuration Guide.

The firmware monitors DC voltage thresholds every 30 seconds. If cell voltage drops below 3.1V, the inverter initiates low-power sleep mode.

Emergency bypass contactors can be manually triggered via panel switch S3.
Ensure physical lockout tags are in place before inspecting capacitor banks.`;

      const chunks = splitIntoVerifiableChunks('src-test-01', 'Inverter Guide', sampleText, 'internal');
      expect(chunks.length).toBeGreaterThanOrEqual(3);

      for (const chunk of chunks) {
        // Strict invariant: raw_content.slice(char_start, char_end) === text_content
        const slice = sampleText.slice(chunk.char_start, chunk.char_end);
        expect(slice).toBe(chunk.text_content);
      }
    });
  });

  describe('Content Hash Deduplication', () => {
    it('produces only one stored source when importing duplicate content', () => {
      const content = `Standard Operating Procedure: Weekly Clinic Generator Maintenance.
1. Inspect fuel levels and verify coolant pressure.
2. Log runtime hours on log sheet SOP-12.`;

      const input = {
        project_id: 'proj-solarpulse-01',
        title: 'Generator Maintenance SOP',
        author: 'Alex Mercer',
        source_type: 'markdown' as const,
        raw_content: content,
        visibility: 'all_members' as const,
        allowed_member_ids: [],
      };

      // First import
      const res1 = db.importSource(input, 'user-alex-departing');
      expect(res1.isDuplicate).toBe(false);
      const originalId = res1.source.id;

      // Duplicate import with same content
      const res2 = db.importSource(input, 'user-alex-departing');
      expect(res2.isDuplicate).toBe(true);
      expect(res2.source.id).toBe(originalId);

      // Verify source was not stored twice
      const allProjectSources = db.getAllSources('proj-solarpulse-01');
      const matching = allProjectSources.filter(s => s.content_hash === res1.source.content_hash);
      expect(matching.length).toBe(1);
    });
  });

  describe('Safe JSON Validation & Malformed JSON Rejection', () => {
    it('rejects malformed JSON with a clear safe error and stores nothing', () => {
      const malformedJson = `{ "format": "issue_export", "issues": [ { "id": "SEC-1", "title": "Unclosed quote } ]`;

      const input = {
        project_id: 'proj-solarpulse-01',
        title: 'Broken JSON File',
        author: 'Alex Mercer',
        source_type: 'json_export' as const,
        raw_content: malformedJson,
        visibility: 'all_members' as const,
        allowed_member_ids: [],
      };

      expect(() => db.importSource(input, 'user-alex-departing')).toThrow(/Malformed JSON export/);

      // Verify nothing was stored
      const sources = db.getAllSources('proj-solarpulse-01');
      expect(sources.some(s => s.title === 'Broken JSON File')).toBe(false);
    });

    it('successfully parses valid structured issue export and message export', () => {
      const validIssueExport = JSON.stringify({
        format: 'issue_export',
        project_title: 'Battery Telemetry',
        issues: [
          {
            id: 'ISSUE-101',
            title: 'MQTT Buffer Overflow on Cellular Drop',
            description: 'When rural cell tower drops, local SQLite queue overflows after 48h.',
            author: 'Maya Patel',
            status: 'in-progress',
          },
        ],
      });

      const res = db.importSource({
        project_id: 'proj-solarpulse-01',
        title: 'GitHub Issues Sync',
        author: 'Issue Sync Bot',
        source_type: 'json_export',
        raw_content: validIssueExport,
        visibility: 'all_members',
        allowed_member_ids: [],
      }, 'user-elena-lead');

      expect(res.isDuplicate).toBe(false);
      expect(res.source.metadata?.format).toBe('issue_export');
      expect(res.source.passages.length).toBeGreaterThan(0);
      expect(res.source.raw_content).toContain('[ISSUE-101] MQTT Buffer Overflow');
    });
  });

  describe('Permissions-Filtered Full-Text Search', () => {
    it('ensures a restricted source does NOT appear in search results for a member who lacks access', async () => {
      // 1. Elena (Project Lead) imports a restricted source visible ONLY to Elena and Sarah
      const restrictedContent = `CONFIDENTIAL RESEARCH: Advanced Sodium-Ion Anode Thermal Degradation Experiment 99.
Sodium-ion test cell SN-99 showed zero thermal runaway up to 65C.`;

      const importRes = await request(app)
        .post('/api/projects/proj-solarpulse-01/sources/import')
        .set('x-user-id', 'user-elena-lead')
        .send({
          title: 'Sodium-Ion Battery Breakthrough',
          author: 'Elena Rostova',
          source_type: 'pasted_text',
          raw_content: restrictedContent,
          visibility: 'restricted_members',
          allowed_member_ids: ['user-elena-lead', 'user-sarah-reviewer'], // Maya Patel is NOT in this list!
          clearance_level: 'confidential',
        });
      expect(importRes.status).toBe(201);

      // 2. Elena searches for "Sodium-Ion" -> MUST SEE RESULTS
      const elenaSearch = await request(app)
        .get('/api/projects/proj-solarpulse-01/search?q=Sodium-Ion')
        .set('x-user-id', 'user-elena-lead');
      expect(elenaSearch.status).toBe(200);
      expect(elenaSearch.body.length).toBeGreaterThanOrEqual(1);
      expect(elenaSearch.body.some((r: any) => r.source_title.includes('Sodium-Ion'))).toBe(true);

      // 3. Maya Patel (Project Member, but not on allowed_member_ids and clearance internal) searches "Sodium-Ion"
      // MUST NOT SEE the restricted source in results!
      const mayaSearch = await request(app)
        .get('/api/projects/proj-solarpulse-01/search?q=Sodium-Ion')
        .set('x-user-id', 'user-maya-recipient-internal');
      expect(mayaSearch.status).toBe(200);
      expect(mayaSearch.body.some((r: any) => r.source_title.includes('Sodium-Ion'))).toBe(false);

      // 4. Liam Vance (Public Volunteer) searches "Sodium-Ion" -> MUST BE EMPTY
      const liamSearch = await request(app)
        .get('/api/projects/proj-solarpulse-01/search?q=Sodium-Ion')
        .set('x-user-id', 'user-liam-recipient-public');
      expect(liamSearch.status).toBe(200);
      expect(liamSearch.body.length).toBe(0);
    });

    it('returns exact character offsets and source info for matched search results', async () => {
      const searchRes = await request(app)
        .get('/api/projects/proj-solarpulse-01/search?q=MQTT')
        .set('x-user-id', 'user-elena-lead');

      expect(searchRes.status).toBe(200);
      expect(searchRes.body.length).toBeGreaterThan(0);

      const firstMatch = searchRes.body[0];
      expect(firstMatch.source_title).toBeDefined();
      expect(firstMatch.char_start).toBeGreaterThanOrEqual(0);
      expect(firstMatch.char_end).toBeGreaterThan(firstMatch.char_start);
      expect(firstMatch.snippet).toContain('MQTT');
    });
  });
});

