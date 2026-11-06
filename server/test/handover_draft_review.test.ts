import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { db } from '../src/db/store.js';

describe('Phase 4: Recipient-Specific Handover Draft & Review Workspace', () => {
  beforeEach(() => {
    db.resetToSeed();
  });

  describe('Pre-Prompt Clearance & Recipient Isolation (Rule 1 & Phase 4)', () => {
    it('generates a draft for recipient A (public) containing no content restricted to recipient B (confidential/restricted)', async () => {
      // Liam Vance has 'public' clearance level
      // Maya Patel has 'internal' clearance level
      // Elena Rostova has 'restricted' clearance level
      const liamUser = db.getUser('user-liam-recipient-public');
      const elenaUser = db.getUser('user-elena-lead');
      expect(liamUser?.clearance_level).toBe('public');
      expect(elenaUser?.clearance_level).toBe('restricted');

      // 1. Generate draft for Liam (public)
      const liamDraftRes = await request(app)
        .post('/api/handovers/generate')
        .send({
          project_id: 'proj-solarpulse-01',
          departing_user_id: 'user-alex-departing',
          recipient_user_id: 'user-liam-recipient-public',
          title: 'Handover Draft for Liam Vance (Public Volunteer)',
        });

      expect(liamDraftRes.status).toBe(201);
      const liamDraft = liamDraftRes.body;
      expect(liamDraft.recipient_clearance).toBe('public');

      // Check all quotations in Liam's draft: none should come from internal or confidential sources
      const allLiamPassageIds = liamDraft.items.flatMap((it: any) => it.quotations.map((q: any) => q.passage_id));
      for (const pid of allLiamPassageIds) {
        const passage = db.getPassage(pid);
        expect(passage?.clearance_level).toBe('public');
      }

      // Liam's draft text must NOT mention confidential LithiumCell battery runaway or confidential vendor contract
      const liamDraftStr = JSON.stringify(liamDraft);
      expect(liamDraftStr).not.toContain('LithiumCell batch LC-8890');
      expect(liamDraftStr).not.toContain('nondisclosure agreement with vendor');

      // 2. Generate draft for Elena (restricted)
      const elenaDraftRes = await request(app)
        .post('/api/handovers/generate')
        .send({
          project_id: 'proj-solarpulse-01',
          departing_user_id: 'user-alex-departing',
          recipient_user_id: 'user-elena-lead',
          title: 'Handover Draft for Elena Rostova (Lead)',
        });

      expect(elenaDraftRes.status).toBe(201);
      const elenaDraft = elenaDraftRes.body;
      expect(elenaDraft.recipient_clearance).toBe('restricted');
      // Elena's draft CAN see confidential passages
      const elenaPassages = elenaDraft.items.flatMap((it: any) => it.quotations.map((q: any) => q.passage_id));
      const hasConfidentialOrInternal = elenaPassages.some((pid: string) => {
        const passage = db.getPassage(pid);
        return passage?.clearance_level === 'internal' || passage?.clearance_level === 'confidential' || passage?.clearance_level === 'restricted';
      });
      expect(hasConfidentialOrInternal).toBe(true);
    });

    it('respects selected_sections in draft generation request', async () => {
      const res = await request(app)
        .post('/api/handovers/generate')
        .send({
          project_id: 'proj-solarpulse-01',
          departing_user_id: 'user-alex-departing',
          recipient_user_id: 'user-maya-recipient-internal',
          title: 'Targeted Handover: Blockers and Decisions Only',
          selected_sections: ['decisions_rationale', 'blockers'],
        });

      expect(res.status).toBe(201);
      const plan = res.body;
      for (const item of plan.items) {
        expect(['decisions_rationale', 'blockers']).toContain(item.section);
      }
    });
  });

  describe('Review Workspace: Item Actions & Whole Draft Approval Rules', () => {
    it('editing an item creates reviewer context and keeps original source passage unchanged', async () => {
      // 1. Generate draft
      const genRes = await request(app)
        .post('/api/handovers/generate')
        .send({
          project_id: 'proj-solarpulse-01',
          departing_user_id: 'user-alex-departing',
          recipient_user_id: 'user-maya-recipient-internal',
          title: 'Handover for Maya',
        });
      const plan = genRes.body;
      const targetItem = plan.items[0];
      const referencedPassageId = targetItem.quotations[0].passage_id;

      // Capture original passage text from DB
      const originalPassage = db.getPassage(referencedPassageId);
      expect(originalPassage).toBeDefined();
      const originalText = originalPassage!.text_content;

      // 2. Reviewer edits the item
      const editRes = await request(app)
        .post(`/api/handovers/${plan.id}/review`)
        .set('x-user-id', 'user-sarah-reviewer')
        .send({
          action: 'edit_item',
          item_id: targetItem.id,
          item_patch: {
            statement: 'Reviewer clarification: Verified MQTT backpressure buffers up to 72 hours under surge.',
          },
          comment: 'Clarified backpressure buffer capacity based on staging run.',
        });

      expect(editRes.status).toBe(200);
      const updatedPlan = editRes.body;
      const editedItem = updatedPlan.items.find((it: any) => it.id === targetItem.id);

      expect(editedItem.statement).toContain('Reviewer clarification: Verified MQTT backpressure buffers');
      expect(editedItem.reviewer_status).toBe('edited');
      expect(editedItem.reviewer_context).toBeDefined();
      expect(editedItem.reviewer_context.reviewer_id).toBe('user-sarah-reviewer');
      expect(editedItem.reviewer_context.original_statement).toBe(targetItem.statement);

      // INVARIANT: Original source passage text MUST BE UNCHANGED
      const currentPassage = db.getPassage(referencedPassageId);
      expect(currentPassage!.text_content).toBe(originalText);
    });

    it('rejecting an item removes it from the approved draft upon final sign-off', async () => {
      // 1. Generate draft
      const genRes = await request(app)
        .post('/api/handovers/generate')
        .send({
          project_id: 'proj-solarpulse-01',
          departing_user_id: 'user-alex-departing',
          recipient_user_id: 'user-maya-recipient-internal',
          title: 'Handover with Rejected Item Test',
        });
      const plan = genRes.body;
      expect(plan.items.length).toBeGreaterThanOrEqual(2);

      const rejectedTarget = plan.items[0];
      const keptItem = plan.items[1];

      // 2. Reject the first item
      const rejectRes = await request(app)
        .post(`/api/handovers/${plan.id}/review`)
        .set('x-user-id', 'user-sarah-reviewer')
        .send({
          action: 'reject_item',
          item_id: rejectedTarget.id,
          comment: 'Out of scope for this handover recipient.',
        });
      expect(rejectRes.status).toBe(200);

      // 3. Approve all other items so draft can be approved
      for (const item of plan.items.slice(1)) {
        await request(app)
          .post(`/api/handovers/${plan.id}/review`)
          .set('x-user-id', 'user-sarah-reviewer')
          .send({
            action: 'approve_item',
            item_id: item.id,
          });
      }

      // 4. Approve the whole draft
      const approveDraftRes = await request(app)
        .post(`/api/handovers/${plan.id}/review`)
        .set('x-user-id', 'user-sarah-reviewer')
        .send({
          action: 'approve',
          comment: 'Final approval after excluding irrelevant item.',
        });

      expect(approveDraftRes.status).toBe(200);
      const approvedPlan = approveDraftRes.body;
      expect(approvedPlan.status).toBe('approved');

      // INVARIANT: Rejected item must NOT appear in the approved draft
      const foundRejected = approvedPlan.items.find((it: any) => it.id === rejectedTarget.id);
      expect(foundRejected).toBeUndefined();

      // Non-rejected item must remain
      const foundKept = approvedPlan.items.find((it: any) => it.id === keptItem.id);
      expect(foundKept).toBeDefined();
    });

    it('refuses to approve the whole draft if any factual item is unapproved and not explicitly marked unknown', async () => {
      // 1. Generate draft
      const genRes = await request(app)
        .post('/api/handovers/generate')
        .send({
          project_id: 'proj-solarpulse-01',
          departing_user_id: 'user-alex-departing',
          recipient_user_id: 'user-maya-recipient-internal',
          title: 'Unapproved Item Constraint Test',
        });
      const plan = genRes.body;

      // Attempt to approve immediately without reviewing items (all items are currently 'pending')
      const prematureApproveRes = await request(app)
        .post(`/api/handovers/${plan.id}/review`)
        .set('x-user-id', 'user-sarah-reviewer')
        .send({
          action: 'approve',
          comment: 'Attempting premature approval.',
        });

      // Must fail with 400 and clear error
      expect(prematureApproveRes.status).toBe(400);
      expect(prematureApproveRes.body.error).toContain('Every factual item must be approved or explicitly marked unknown');

      // Now approve or verify all items:
      for (const it of plan.items) {
        if (it.verification_status !== 'unknown' && !it.is_suggestion) {
          await request(app)
            .post(`/api/handovers/${plan.id}/review`)
            .set('x-user-id', 'user-sarah-reviewer')
            .send({
              action: 'approve_item',
              item_id: it.id,
            });
        }
      }

      // Now draft approval succeeds!
      const validApproveRes = await request(app)
        .post(`/api/handovers/${plan.id}/review`)
        .set('x-user-id', 'user-sarah-reviewer')
        .send({
          action: 'approve',
          comment: 'Every item verified.',
        });

      expect(validApproveRes.status).toBe(200);
      expect(validApproveRes.body.status).toBe('approved');
    });
  });
});

