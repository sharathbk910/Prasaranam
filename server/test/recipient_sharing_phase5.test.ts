import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { db } from '../src/db/store.js';

describe('Phase 5: Sharing with Two Recipients Having Different Access', () => {
  beforeEach(() => {
    db.resetToSeed();
  });

  describe('Multi-Recipient Access Control & Evidence Links', () => {
    it('Two recipients with different access each see only their own approved content and evidence links', async () => {
      // Add Liam as a public/guest member of PayPulse
      db.addMembership('user-liam-recipient-public', 'proj-payments-01', 'guest');

      // 1. Generate & approve handover for Recipient A: Sarah Chen (Restricted Clearance)
      const resA = await request(app)
        .post('/api/handovers/generate')
        .send({
          project_id: 'proj-payments-01',
          departing_user_id: 'user-alex-departing',
          recipient_user_id: 'user-sarah-reviewer',
          title: 'Handover for Recipient A (Restricted)',
        });
      expect(resA.status).toBe(201);
      const planA = resA.body;

      // Approve all items for Plan A
      for (const item of planA.items) {
        await request(app)
          .post(`/api/handovers/${planA.id}/review`)
          .set('x-user-id', 'user-sarah-reviewer')
          .send({ action: 'approve_item', item_id: item.id });
      }

      // Approve and share Plan A
      await request(app)
        .post(`/api/handovers/${planA.id}/review`)
        .set('x-user-id', 'user-sarah-reviewer')
        .send({ action: 'approve', comment: 'Approved for Sarah' });
      await request(app)
        .post(`/api/handovers/${planA.id}/review`)
        .set('x-user-id', 'user-sarah-reviewer')
        .send({ action: 'share', comment: 'Shared with Sarah' });

      // 2. Generate & approve handover for Recipient B: Liam Vance (Public Clearance)
      const resB = await request(app)
        .post('/api/handovers/generate')
        .send({
          project_id: 'proj-payments-01',
          departing_user_id: 'user-alex-departing',
          recipient_user_id: 'user-liam-recipient-public',
          title: 'Handover for Recipient B (Public)',
        });
      expect(resB.status).toBe(201);
      const planB = resB.body;

      // Approve items and share Plan B
      for (const item of planB.items) {
        await request(app)
          .post(`/api/handovers/${planB.id}/review`)
          .set('x-user-id', 'user-sarah-reviewer')
          .send({ action: 'approve_item', item_id: item.id });
      }
      await request(app)
        .post(`/api/handovers/${planB.id}/review`)
        .set('x-user-id', 'user-sarah-reviewer')
        .send({ action: 'approve', comment: 'Approved for Liam' });
      await request(app)
        .post(`/api/handovers/${planB.id}/review`)
        .set('x-user-id', 'user-sarah-reviewer')
        .send({ action: 'share', comment: 'Shared with Liam' });

      // 3. Recipient A reads Plan A
      const readA = await request(app)
        .get(`/api/handovers/${planA.id}`)
        .set('x-user-id', 'user-sarah-reviewer');
      expect(readA.status).toBe(200);

      // Verify Recipient A sees restricted source citations as accessible
      const passagesA = readA.body.items.flatMap((i: any) => i.quotations);
      const accessibleQuotationsA = passagesA.filter((q: any) => q.is_source_accessible);
      expect(accessibleQuotationsA.length).toBeGreaterThan(0);

      // Recipient A can directly fetch the restricted passage
      const restrictedPassageId = passagesA[0].passage_id;
      const passageFetchA = await request(app)
        .get(`/api/passages/${restrictedPassageId}`)
        .set('x-user-id', 'user-sarah-reviewer');
      expect(passageFetchA.status).toBe(200);

      // 4. Recipient B reads Plan B
      const readB = await request(app)
        .get(`/api/handovers/${planB.id}`)
        .set('x-user-id', 'user-liam-recipient-public');
      expect(readB.status).toBe(200);

      // 5. If Recipient B attempts to fetch the restricted passage directly, server returns 403 Forbidden
      const passageFetchB = await request(app)
        .get(`/api/passages/${restrictedPassageId}`)
        .set('x-user-id', 'user-liam-recipient-public');
      expect(passageFetchB.status).toBe(403);
      expect(passageFetchB.body.error).toMatch(/restricted to clearance level|insufficient/i);
    });
  });

  describe('Security & Live Permissions Rechecking on Every Read', () => {
    it('A cross-project request returns a denial, not the data', async () => {
      // 1. Generate an approved handover for PayPulse
      const genRes = await request(app)
        .post('/api/handovers/generate')
        .send({
          project_id: 'proj-payments-01',
          departing_user_id: 'user-alex-departing',
          recipient_user_id: 'user-maya-recipient-internal',
          title: 'PayPulse Handover for Cross-Project Test',
        });
      const planId = genRes.body.id;

      // 2. Create user that is NOT a member of PayPulse
      const session = db.signUp('contractor@external.org', 'Pass1234!', 'External Contractor');

      // 3. Attempt to access PayPulse handover plan
      const res = await request(app)
        .get(`/api/handovers/${planId}`)
        .set('x-user-id', session.user.id);

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/access denied: you are not a member of this project/i);
    });

    it('A recipient removed from the project cannot open the handover', async () => {
      // Maya is a member of SolarPulse and has an approved/shared handover
      const resGen = await request(app)
        .post('/api/handovers/generate')
        .send({
          project_id: 'proj-solarpulse-01',
          departing_user_id: 'user-alex-departing',
          recipient_user_id: 'user-maya-recipient-internal',
          title: 'SolarPulse Handover for Maya',
        });
      const planId = resGen.body.id;

      // Approve and share plan
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
      await request(app)
        .post(`/api/handovers/${planId}/review`)
        .set('x-user-id', 'user-sarah-reviewer')
        .send({ action: 'share' });

      // Maya can initially read the approved handover
      const initialRead = await request(app)
        .get(`/api/handovers/${planId}`)
        .set('x-user-id', 'user-maya-recipient-internal');
      expect(initialRead.status).toBe(200);

      // Now remove Maya from the project
      const removeRes = await request(app)
        .delete('/api/projects/proj-solarpulse-01/members/user-maya-recipient-internal')
        .set('x-user-id', 'user-elena-lead');
      expect(removeRes.status).toBe(200);

      // Maya tries to read the handover again: server rechecks permissions and denies access
      const revokedRead = await request(app)
        .get(`/api/handovers/${planId}`)
        .set('x-user-id', 'user-maya-recipient-internal');
      expect(revokedRead.status).toBe(403);
      expect(revokedRead.body.error).toMatch(/membership was revoked|not a member/i);
    });

    it('Recipient cannot view unapproved drafts before reviewer approval', async () => {
      const resGen = await request(app)
        .post('/api/handovers/generate')
        .send({
          project_id: 'proj-solarpulse-01',
          departing_user_id: 'user-alex-departing',
          recipient_user_id: 'user-maya-recipient-internal',
          title: 'Unapproved Draft Test',
        });
      const planId = resGen.body.id;

      // Maya attempts to read unapproved draft
      const readRes = await request(app)
        .get(`/api/handovers/${planId}`)
        .set('x-user-id', 'user-maya-recipient-internal');

      expect(readRes.status).toBe(403);
      expect(readRes.body.error).toMatch(/pending human review/i);
    });
  });

  describe('Acknowledgement of Receipt', () => {
    it('Recipient confirms reading the handover, recording timestamp, notes, and audit entry', async () => {
      // Set up shared handover for Maya
      const resGen = await request(app)
        .post('/api/handovers/generate')
        .send({
          project_id: 'proj-solarpulse-01',
          departing_user_id: 'user-alex-departing',
          recipient_user_id: 'user-maya-recipient-internal',
          title: 'SolarPulse Recipient Confirmation Test',
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
      await request(app)
        .post(`/api/handovers/${planId}/review`)
        .set('x-user-id', 'user-sarah-reviewer')
        .send({ action: 'share' });

      // Maya acknowledges receipt
      const ackRes = await request(app)
        .post(`/api/handovers/${planId}/acknowledge`)
        .set('x-user-id', 'user-maya-recipient-internal')
        .send({
          notes: 'Read and understood telemetry failover runbooks. Ready for transition.',
        });

      expect(ackRes.status).toBe(200);
      expect(ackRes.body.acknowledged_at).toBeDefined();
      expect(ackRes.body.acknowledged_by).toContain('Maya Patel');
      expect(ackRes.body.acknowledged_notes).toBe('Read and understood telemetry failover runbooks. Ready for transition.');

      // Check audit trail
      const auditLogs = ackRes.body.audit_logs;
      const ackLog = auditLogs.find((l: any) => l.action === 'RECIPIENT_ACKNOWLEDGED');
      expect(ackLog).toBeDefined();
      expect(ackLog.details).toContain('telemetry failover runbooks');

      // Unauthorized user cannot acknowledge someone else's handover
      const badAck = await request(app)
        .post(`/api/handovers/${planId}/acknowledge`)
        .set('x-user-id', 'user-liam-recipient-public')
        .send({ notes: 'Imposter acknowledgment' });
      expect(badAck.status).toBe(400);
      expect(badAck.body.error).toMatch(/only the designated recipient/i);
    });
  });
});
