import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { db } from '../src/db/store.js';

describe('Phase 6: Export, Redacted Audit History & Negative-Access Testing', () => {
  beforeEach(() => {
    db.resetToSeed();
    // Add Liam Vance as guest member of PayPulse
    db.addMembership('user-liam-recipient-public', 'proj-payments-01', 'guest');
  });

  describe('Negative-Access Testing Across Views, Search, Q&A, and Exports', () => {
    it('restricted sources never appear in full-text search results for low clearance users', async () => {
      // Liam Vance has public clearance
      const searchRes = await request(app)
        .get('/api/projects/proj-payments-01/search?q=vault')
        .set('x-user-id', 'user-liam-recipient-public');

      expect(searchRes.status).toBe(200);
      const results = searchRes.body;
      // Restricted sources (such as Vault Tokenization architecture) must NOT appear in search results
      for (const r of results) {
        expect(r.clearance_level).not.toBe('restricted');
        expect(r.clearance_level).not.toBe('confidential');
      }
    });

    it('restricted sources never leak into recipient handover views', async () => {
      // Generate handover for Liam Vance (Public)
      const resGen = await request(app)
        .post('/api/handovers/generate')
        .send({
          project_id: 'proj-payments-01',
          departing_user_id: 'user-alex-departing',
          recipient_user_id: 'user-liam-recipient-public',
          title: 'Liam Public PayPulse Handover',
        });
      expect(resGen.status).toBe(201);
      const plan = resGen.body;

      // Approve & share plan
      for (const item of plan.items) {
        await request(app)
          .post(`/api/handovers/${plan.id}/review`)
          .set('x-user-id', 'user-sarah-reviewer')
          .send({ action: 'approve_item', item_id: item.id });
      }
      await request(app)
        .post(`/api/handovers/${plan.id}/review`)
        .set('x-user-id', 'user-sarah-reviewer')
        .send({ action: 'approve' });
      await request(app)
        .post(`/api/handovers/${plan.id}/review`)
        .set('x-user-id', 'user-sarah-reviewer')
        .send({ action: 'share' });

      // Liam reads the approved handover
      const readRes = await request(app)
        .get(`/api/handovers/${plan.id}`)
        .set('x-user-id', 'user-liam-recipient-public');

      expect(readRes.status).toBe(200);
      const fetchedPlan = readRes.body;

      // Assert no quotation quotes restricted passages
      for (const item of fetchedPlan.items) {
        for (const q of item.quotations) {
          if (q.source_clearance === 'restricted' || q.source_clearance === 'confidential') {
            expect(q.is_source_accessible).toBe(false);
            expect(q.quote).toMatch(/Restricted Passage/i);
          }
        }
      }
    });

    it('restricted sources never appear in Markdown exports for low clearance users', async () => {
      const resGen = await request(app)
        .post('/api/handovers/generate')
        .send({
          project_id: 'proj-payments-01',
          departing_user_id: 'user-alex-departing',
          recipient_user_id: 'user-liam-recipient-public',
          title: 'Liam Export Test',
        });
      const planId = resGen.body.id;

      for (const item of resGen.body.items) {
        await request(app)
          .post(`/api/handovers/${planId}/review`)
          .set('x-user-id', 'user-sarah-reviewer')
          .send({ action: 'approve_item', item_id: item.id });
      }
      await request(app)
        .post(`/api/handovers/${planId}/review`)
        .set('x-user-id', 'user-sarah-reviewer')
        .send({ action: 'approve' });

      // Liam exports as Markdown
      const exportRes = await request(app)
        .get(`/api/handovers/${planId}/export/markdown`)
        .set('x-user-id', 'user-liam-recipient-public');

      expect(exportRes.status).toBe(200);
      expect(exportRes.headers['content-type']).toMatch(/text\/markdown/i);
      const markdown = exportRes.text;

      // Confirm no secret vault passages or restricted content appear in plain text
      expect(markdown).not.toMatch(/unencrypted callbacks across external networks/i);
      expect(markdown).toContain('Project Knowledge Handover: Liam Export Test');
    });

    it('exporting an unapproved draft is rejected with 400 Bad Request', async () => {
      const resGen = await request(app)
        .post('/api/handovers/generate')
        .send({
          project_id: 'proj-payments-01',
          departing_user_id: 'user-alex-departing',
          recipient_user_id: 'user-liam-recipient-public',
          title: 'Unapproved Draft Export Block',
        });
      const planId = resGen.body.id;

      // Attempt to export without human review approval
      const exportRes = await request(app)
        .get(`/api/handovers/${planId}/export/markdown`)
        .set('x-user-id', 'user-sarah-reviewer');

      expect(exportRes.status).toBe(400);
      expect(exportRes.body.error).toMatch(/only approved handovers can be exported/i);
    });
  });

  describe('Redacted Audit History', () => {
    it('audit history records approvals, views, and edits without leaking sensitive passages', async () => {
      const resGen = await request(app)
        .post('/api/handovers/generate')
        .send({
          project_id: 'proj-solarpulse-01',
          departing_user_id: 'user-alex-departing',
          recipient_user_id: 'user-maya-recipient-internal',
          title: 'SolarPulse Audit Log Test',
        });
      const planId = resGen.body.id;

      // Sarah approves and edits
      await request(app)
        .post(`/api/handovers/${planId}/review`)
        .set('x-user-id', 'user-sarah-reviewer')
        .send({ action: 'approve_item', item_id: resGen.body.items[0].id });

      // Maya views handover
      await request(app)
        .get(`/api/handovers/${planId}`)
        .set('x-user-id', 'user-maya-recipient-internal');

      // Fetch redacted audit history
      const auditRes = await request(app)
        .get(`/api/handovers/${planId}/audit-log`)
        .set('x-user-id', 'user-maya-recipient-internal');

      expect(auditRes.status).toBe(200);
      const logs = auditRes.body;
      expect(Array.isArray(logs)).toBe(true);
      expect(logs.length).toBeGreaterThan(0);

      // Verify each log entry is marked redacted and contains no raw passage secrets
      for (const log of logs) {
        expect(log.redacted).toBe(true);
        expect(log.details).not.toMatch(/Passage:\s*".*?"/i);
      }
    });
  });
});

