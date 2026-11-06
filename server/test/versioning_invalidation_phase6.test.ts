import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { db } from '../src/db/store.js';

describe('Phase 6: Versioning and Permission-Driven Invalidation', () => {
  beforeEach(() => {
    db.resetToSeed();
  });

  describe('Immutable Approved Versions & Edit-Triggered New Drafts', () => {
    it('editing an approved version creates a new draft version requiring human re-approval', async () => {
      // 1. Generate handover for Maya
      const resGen = await request(app)
        .post('/api/handovers/generate')
        .send({
          project_id: 'proj-solarpulse-01',
          departing_user_id: 'user-alex-departing',
          recipient_user_id: 'user-maya-recipient-internal',
          title: 'SolarPulse Versioning Test',
        });
      const plan = resGen.body;
      const planId = plan.id;
      expect(plan.version_number).toBe(1);

      // 2. Approve all items and approve the entire draft (v1)
      for (const item of plan.items) {
        await request(app)
          .post(`/api/handovers/${planId}/review`)
          .set('x-user-id', 'user-sarah-reviewer')
          .send({ action: 'approve_item', item_id: item.id });
      }
      const approveRes = await request(app)
        .post(`/api/handovers/${planId}/review`)
        .set('x-user-id', 'user-sarah-reviewer')
        .send({ action: 'approve', comment: 'Approved v1' });
      expect(approveRes.status).toBe(200);
      expect(approveRes.body.status).toBe('approved');
      expect(approveRes.body.version_number).toBe(1);

      // Verify approved version snapshot exists
      const frozenApproved = db.getApprovedVersion(planId);
      expect(frozenApproved).toBeDefined();
      expect(frozenApproved?.status).toBe('approved');

      // 3. Reviewer edits an item in the approved handover
      const editRes = await request(app)
        .post(`/api/handovers/${planId}/review`)
        .set('x-user-id', 'user-sarah-reviewer')
        .send({
          action: 'edit_item',
          item_id: plan.items[0].id,
          edited_statement: 'Updated emergency telemetry threshold to 85% battery discharge.',
          comment: 'Post-approval modification based on battery engineering memo.',
        });

      expect(editRes.status).toBe(200);
      // Handover transitions to under_review with version_number incremented to 2!
      expect(editRes.body.status).toBe('under_review');
      expect(editRes.body.version_number).toBe(2);
      expect(editRes.body.parent_approved_version_id).toBe(planId);

      // 4. Maya (recipient) tries to read the handover: blocked because v2 is an unapproved draft!
      const mayaReadRes = await request(app)
        .get(`/api/handovers/${planId}`)
        .set('x-user-id', 'user-maya-recipient-internal');

      // The unapproved draft is pending review
      expect(mayaReadRes.status).toBe(403);
      expect(mayaReadRes.body.error).toMatch(/pending human review/i);

      // 5. Reviewer approves v2 draft
      await request(app)
        .post(`/api/handovers/${planId}/review`)
        .set('x-user-id', 'user-sarah-reviewer')
        .send({ action: 'approve_item', item_id: plan.items[0].id });

      const reApproveRes = await request(app)
        .post(`/api/handovers/${planId}/review`)
        .set('x-user-id', 'user-sarah-reviewer')
        .send({ action: 'approve', comment: 'Approved v2' });

      expect(reApproveRes.status).toBe(200);
      expect(reApproveRes.body.status).toBe('approved');
      expect(reApproveRes.body.version_number).toBe(2);

      // Maya can now read the approved v2
      const mayaReadV2 = await request(app)
        .get(`/api/handovers/${planId}`)
        .set('x-user-id', 'user-maya-recipient-internal');
      expect(mayaReadV2.status).toBe(200);
      expect(mayaReadV2.body.version_number).toBe(2);
    });
  });

  describe('Permission-Driven Invalidation & Access Revocation', () => {
    it('removing a member immediately blocks access to the handover on the server', async () => {
      // 1. Generate & approve handover for Maya
      const resGen = await request(app)
        .post('/api/handovers/generate')
        .send({
          project_id: 'proj-solarpulse-01',
          departing_user_id: 'user-alex-departing',
          recipient_user_id: 'user-maya-recipient-internal',
          title: 'SolarPulse Membership Revocation Test',
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

      // Maya can read approved handover
      const read1 = await request(app)
        .get(`/api/handovers/${planId}`)
        .set('x-user-id', 'user-maya-recipient-internal');
      expect(read1.status).toBe(200);

      // 2. Remove Maya from project
      const removeRes = await request(app)
        .delete('/api/projects/proj-solarpulse-01/members/user-maya-recipient-internal')
        .set('x-user-id', 'user-elena-lead');
      expect(removeRes.status).toBe(200);

      // 3. Maya attempts to read: blocked with 403 Forbidden!
      const readBlocked = await request(app)
        .get(`/api/handovers/${planId}`)
        .set('x-user-id', 'user-maya-recipient-internal');
      expect(readBlocked.status).toBe(403);
      expect(readBlocked.body.error).toMatch(/membership was revoked|not a member/i);
    });

    it('demoting recipient clearance marks approved handover stale and blocks viewing until regenerated', async () => {
      // 1. Generate & approve handover for Maya (who has internal clearance)
      const resGen = await request(app)
        .post('/api/handovers/generate')
        .send({
          project_id: 'proj-solarpulse-01',
          departing_user_id: 'user-alex-departing',
          recipient_user_id: 'user-maya-recipient-internal',
          title: 'Clearance Demotion Staleness Test',
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

      // 2. Demote Maya's clearance from 'internal' to 'public'
      const mayaUser = db.getUser('user-maya-recipient-internal')!;
      mayaUser.clearance_level = 'public';

      // 3. Maya reads handover: server detects staleness because approved handover contains internal sources!
      const readStale = await request(app)
        .get(`/api/handovers/${planId}`)
        .set('x-user-id', 'user-maya-recipient-internal');

      expect(readStale.status).toBe(403);
      expect(readStale.body.is_stale).toBe(true);
      expect(readStale.body.error).toMatch(/stale/i);
    });
  });
});

