import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { db } from '../src/db/store.js';

describe('Server REST API Endpoints', () => {
  beforeEach(() => {
    db.resetToSeed();
  });

  it('GET /api/health returns server status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('prasaranam-server');
  });

  it('GET /api/users returns synthetic demo users', async () => {
    const res = await request(app).get('/api/users');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(4);
    expect(res.body.some((u: any) => u.name.includes('Elena'))).toBe(true);
  });

  it('GET /api/projects/:id/sources filters sources by recipient clearance', async () => {
    // Internal user should not see confidential or restricted sources
    const resInternal = await request(app)
      .get('/api/projects/proj-solarpulse-01/sources?clearance=internal')
      .set('x-user-id', 'user-elena-lead');
    expect(resInternal.status).toBe(200);
    const internalTitles = resInternal.body.map((s: any) => s.title);
    expect(internalTitles.some((t: string) => t.includes('Public'))).toBe(true);
    expect(internalTitles.some((t: string) => t.includes('RFC-204'))).toBe(true);
    expect(internalTitles.some((t: string) => t.includes('Hardware Security Module'))).toBe(false); // Restricted!
    expect(internalTitles.some((t: string) => t.includes('Vendor LithiumCell'))).toBe(false); // Confidential!
  });

  it('POST /api/handovers/generate creates a handover plan with non-AI fallback visibly labeled', async () => {
    const payload = {
      project_id: 'proj-solarpulse-01',
      departing_user_id: 'user-alex-departing',
      recipient_user_id: 'user-maya-recipient-internal',
      reviewer_user_id: 'user-sarah-reviewer',
      title: 'Alex Mercer to Maya Patel Handover',
    };

    const res = await request(app).post('/api/handovers/generate').send(payload);
    expect(res.status).toBe(201);
    const plan = res.body;

    expect(plan.id).toBeDefined();
    expect(plan.recipient_clearance).toBe('internal');
    expect(plan.status).toBe('under_review');
    expect(plan.items.length).toBeGreaterThan(0);

    // Rule 7 check: if fallback engine was used, visibly labeled
    if (plan.generated_with_fallback) {
      expect(plan.items.every((it: any) => it.is_fallback === true)).toBe(true);
      expect(plan.audit_logs[0].performed_by).toContain('Deterministic Fallback');
    }

    // Rule 1 check: items must NOT contain restricted HSM keys
    const allText = JSON.stringify(plan.items);
    expect(allText).not.toContain('HSM Root Key Custody');
    expect(allText).not.toContain('elliptic curve private keys');

    // Rule 6 check: verification labels only, no percentages
    for (const item of plan.items) {
      expect(['supported', 'corroborated', 'needs confirmation', 'conflicting', 'unknown']).toContain(item.verification_status);
      expect(item.verification_status).not.toMatch(/%/);
    }
  });

  it('POST /api/handovers/:id/review logs reviewer actions and enforces human sign-off', async () => {
    // Generate a handover first
    const genRes = await request(app).post('/api/handovers/generate').send({
      project_id: 'proj-solarpulse-01',
      departing_user_id: 'user-alex-departing',
      recipient_user_id: 'user-maya-recipient-internal',
      title: 'Review Test Handover',
    });
    const planId = genRes.body.id;

    // 1. Reviewer modifies an item note
    const firstItemId = genRes.body.items[0].id;
    const modRes = await request(app)
      .post(`/api/handovers/${planId}/review`)
      .set('x-user-id', 'user-sarah-reviewer')
      .send({
        action: 'update_item',
        item_id: firstItemId,
        item_patch: { reviewer_status: 'modified' },
        comment: 'Verified with secondary logs.',
      });
    expect(modRes.status).toBe(200);
    expect(modRes.body.items[0].reviewer_notes).toBe('Verified with secondary logs.');

    // Approve all items to satisfy Phase 4 whole-draft approval rule
    for (const item of modRes.body.items) {
      await request(app)
        .post(`/api/handovers/${planId}/review`)
        .set('x-user-id', 'user-sarah-reviewer')
        .send({
          action: 'approve_item',
          item_id: item.id,
        });
    }

    // 2. Human Reviewer approves the handover before sharing
    const approveRes = await request(app)
      .post(`/api/handovers/${planId}/review`)
      .set('x-user-id', 'user-sarah-reviewer')
      .send({
        action: 'approve',
        comment: 'All statements linked to verified sources. Approved for transfer.',
      });
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.status).toBe('approved');
    expect(approveRes.body.approved_at).toBeDefined();

    // 3. Share action
    const shareRes = await request(app)
      .post(`/api/handovers/${planId}/review`)
      .set('x-user-id', 'user-sarah-reviewer')
      .send({
        action: 'share',
        comment: 'Handover shared with recipient.',
      });
    expect(shareRes.status).toBe(200);
    expect(shareRes.body.status).toBe('shared');
  });
});

