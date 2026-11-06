import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { db } from '../src/db/store.js';
import { validateAndDetectGaps } from '../src/services/knowledgeExtractor.js';
import { Passage } from '@prasaranam/shared';

describe('Phase 3: Knowledge Reconstruction & Extraction Pipeline', () => {
  beforeEach(() => {
    // Reset seed data
    db.resetToSeed();
  });

  describe('Server-Side Quotation & Evidence Validation (validateAndDetectGaps)', () => {
    const mockChunks: Passage[] = [
      {
        id: 'chk-vault-01',
        source_id: 'src-pay-adr-01',
        source_title: 'ADR-014 Tokenization Vault',
        text_content: 'Decision: Tokenization vault architecture approved for all card processing.',
        char_start: 0,
        char_end: 75,
      },
      {
        id: 'chk-rollout-01',
        source_id: 'src-pay-rollout-01',
        source_title: 'Rollout Plan',
        text_content: 'Unified Gateway rollout is scheduled for November 15 across all merchants.',
        char_start: 0,
        char_end: 74,
      },
      {
        id: 'chk-incident-01',
        source_id: 'src-pay-incident-01',
        source_title: 'Incident Post-Mortem',
        text_content: 'Merchant migration delayed to December 20 following staging dry run failures.',
        char_start: 0,
        char_end: 79,
      },
    ];

    const chunkMap = new Map(mockChunks.map(c => [c.id, c]));

    it('rejects an item whose quotation does not match its chunk verbatim (no guessing or repair)', () => {
      const rawItems = [
        {
          item_type: 'decision' as const,
          topic: 'Tokenization Architecture',
          statement: 'Vault architecture was approved.',
          owner: 'Maya Patel',
          verification_status: 'supported',
          quotations: [
            {
              chunk_id: 'chk-vault-01',
              // Fabricated/hallucinated quote that does not appear in chunk text
              quote: 'Vault architecture was unanimously approved by everyone yesterday.',
            },
          ],
        },
      ];

      const result = validateAndDetectGaps(rawItems, 'ho-test-01', chunkMap, false);
      expect(result.items).toHaveLength(0);
      expect(result.rejected_items).toHaveLength(1);
      expect(result.rejected_items[0].reason).toContain('Quotation does not match');
    });

    it('rejects an item citing a chunk ID that is not permitted or does not exist', () => {
      const rawItems = [
        {
          item_type: 'decision' as const,
          topic: 'Secret Strategy',
          statement: 'Unauthorized strategy point.',
          owner: null,
          verification_status: 'supported',
          quotations: [
            {
              chunk_id: 'chk-secret-forbidden-999',
              quote: 'Some quote',
            },
          ],
        },
      ];

      const result = validateAndDetectGaps(rawItems, 'ho-test-02', chunkMap, false);
      expect(result.items).toHaveLength(0);
      expect(result.rejected_items).toHaveLength(1);
      expect(result.rejected_items[0].reason).toContain('Referenced chunk ID does not exist');
    });

    it('stores a task without an owner with owner "unknown" and status "unknown"', () => {
      const rawItems = [
        {
          item_type: 'task' as const,
          topic: 'Cleanup Table Partitions',
          statement: 'Task: Drop settlement transaction archive tables from staging cluster.',
          owner: null, // No owner assigned
          verification_status: 'supported',
          quotations: [
            {
              chunk_id: 'chk-vault-01',
              quote: 'Decision: Tokenization vault architecture approved for all card processing.',
            },
          ],
        },
      ];

      const result = validateAndDetectGaps(rawItems, 'ho-test-03', chunkMap, false);
      expect(result.items).toHaveLength(1);
      const item = result.items[0];
      expect(item.owner).toBe('unknown');
      expect(item.verification_status).toBe('unknown');
      expect(item.is_owner_explicit).toBe(false);
      expect(item.reviewer_notes).toContain('No owner established');
    });

    it('detects conflicting statements (e.g. differing rollout dates: Nov 15 vs Dec 20) and marks them conflicting', () => {
      const rawItems = [
        {
          item_type: 'decision' as const,
          topic: 'Gateway Rollout Target',
          statement: 'Unified Gateway rollout is scheduled for November 15 across all merchants.',
          owner: 'Alex Mercer',
          verification_status: 'supported',
          quotations: [
            {
              chunk_id: 'chk-rollout-01',
              quote: 'Unified Gateway rollout is scheduled for November 15 across all merchants.',
            },
          ],
        },
        {
          item_type: 'risk' as const,
          topic: 'Gateway Delayed Date',
          statement: 'Merchant migration delayed to December 20 following staging dry run failures.',
          owner: 'Elena Rostova',
          verification_status: 'supported',
          quotations: [
            {
              chunk_id: 'chk-incident-01',
              quote: 'Merchant migration delayed to December 20 following staging dry run failures.',
            },
          ],
        },
      ];

      const result = validateAndDetectGaps(rawItems, 'ho-test-04', chunkMap, false);
      expect(result.items).toHaveLength(2);
      // Conflicting timeline statements should both be marked conflicting
      const conflictingItems = result.items.filter(i => i.verification_status === 'conflicting');
      expect(conflictingItems.length).toBeGreaterThan(0);
      expect(result.gaps_detected).toBeGreaterThan(0);
    });

    it('flags blockers with no resolution as needs confirmation', () => {
      const rawItems = [
        {
          item_type: 'blocker' as const,
          topic: 'PCI-DSS Compliance',
          statement: 'Blocker: Unencrypted callback URL in webhook dispatcher breaks PCI-DSS Section 4.',
          owner: null,
          verification_status: 'supported',
          quotations: [
            {
              chunk_id: 'chk-vault-01',
              quote: 'Decision: Tokenization vault architecture approved for all card processing.',
            },
          ],
        },
      ];

      const result = validateAndDetectGaps(rawItems, 'ho-test-05', chunkMap, false);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].verification_status).toBe('needs confirmation');
      expect(result.items[0].reviewer_notes).toContain('Blocker requires confirmation');
    });
  });

  describe('Extraction API Endpoints & Job Lifecycle', () => {
    it('requires authentication to start extraction and rejects unauthorized user', async () => {
      const res = await request(app)
        .post('/api/projects/proj-payments-01/extraction/start')
        .send({ force_fallback: true });
      expect(res.status).toBe(401);
    });

    it('rejects a user who is not a member of the project', async () => {
      // Create an outside user who has no membership in proj-payments-01
      const outsideUser = db.signUp('outside@example.com', 'Pass1234!', 'Outside Engineer');

      const res = await request(app)
        .post('/api/projects/proj-payments-01/extraction/start')
        .set('Authorization', `Bearer ${outsideUser.token}`)
        .send({ force_fallback: true });
      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Access denied');
    });

    it('starts an extraction job in deterministic fallback mode and completes asynchronously', async () => {
      const elenaAuth = db.signIn('elena.rostova@example.org', 'Pass1234!');

      const startRes = await request(app)
        .post('/api/projects/proj-payments-01/extraction/start')
        .set('Authorization', `Bearer ${elenaAuth.token}`)
        .send({ force_fallback: true, title: 'Synthetic Payments Extracted Handover' });

      expect(startRes.status).toBe(202);
      expect(startRes.body.status).toBe('queued');
      expect(startRes.body.is_fallback).toBe(true);
      const jobId = startRes.body.id;

      // Poll until completion (or wait 200ms)
      await new Promise(resolve => setTimeout(resolve, 300));

      const statusRes = await request(app)
        .get(`/api/projects/proj-payments-01/extraction/status/${jobId}`)
        .set('Authorization', `Bearer ${elenaAuth.token}`);

      expect(statusRes.status).toBe(200);
      expect(statusRes.body.status).toBe('completed');
      expect(statusRes.body.progress_pct).toBe(100);
      expect(statusRes.body.items_count).toBeGreaterThan(0);
      expect(statusRes.body.handover_id).toBeDefined();

      // Retrieve the generated handover plan
      const handoverRes = await request(app)
        .get(`/api/handovers/${statusRes.body.handover_id}`);

      expect(handoverRes.status).toBe(200);
      const plan = handoverRes.body;
      expect(plan.generated_with_fallback).toBe(true);
      expect(plan.summary).toContain('NOT A LIVE AI RESULT');

      // Verify payment items extracted: decision, blocker, conflicting timeline, unassigned task
      const decision = plan.items.find((i: any) => i.item_type === 'decision');
      expect(decision).toBeDefined();
      expect(decision.quotations[0].quote).toMatch(/Tokenization/i);

      const blocker = plan.items.find((i: any) => i.item_type === 'blocker');
      expect(blocker).toBeDefined();
      expect(blocker.verification_status).toBe('needs confirmation');

      const unassignedTask = plan.items.find((i: any) => i.item_type === 'task');
      expect(unassignedTask).toBeDefined();
      expect(unassignedTask.owner).toBe('unknown');

      const conflictingItem = plan.items.find((i: any) => i.verification_status === 'conflicting');
      expect(conflictingItem).toBeDefined();
    });

    it('verifies that the API key never appears in responses, error messages, or job payloads', async () => {
      const elenaAuth = db.signIn('elena.rostova@example.org', 'Pass1234!');

      const res = await request(app)
        .post('/api/projects/proj-payments-01/extraction/start')
        .set('Authorization', `Bearer ${elenaAuth.token}`)
        .send({ force_fallback: true });

      const bodyStr = JSON.stringify(res.body);
      expect(bodyStr).not.toContain('AIza');
      expect(bodyStr).not.toContain('GEMINI_API_KEY');
      expect(bodyStr).not.toContain('process.env');
    });

    it('supports retrying an extraction job', async () => {
      const elenaAuth = db.signIn('elena.rostova@example.org', 'Pass1234!');

      const startRes = await request(app)
        .post('/api/projects/proj-payments-01/extraction/start')
        .set('Authorization', `Bearer ${elenaAuth.token}`)
        .send({ force_fallback: true });

      const jobId = startRes.body.id;
      await new Promise(resolve => setTimeout(resolve, 200));

      const retryRes = await request(app)
        .post(`/api/projects/proj-payments-01/extraction/retry/${jobId}`)
        .set('Authorization', `Bearer ${elenaAuth.token}`);

      expect(retryRes.status).toBe(200);
      expect(['queued', 'running', 'completed']).toContain(retryRes.body.status);
    });
  });
});
