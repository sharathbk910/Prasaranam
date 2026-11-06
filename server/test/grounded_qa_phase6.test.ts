import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { db } from '../src/db/store.js';

describe('Phase 6: Clarification and Grounded Q&A', () => {
  beforeEach(() => {
    db.resetToSeed();
  });

  describe('Targeted Clarification Questions for Gaps', () => {
    it('generates targeted questions for missing rationales, unowned tasks, and conflicting dates', async () => {
      // Generate draft on payments dataset
      const resGen = await request(app)
        .post('/api/handovers/generate')
        .send({
          project_id: 'proj-payments-01',
          departing_user_id: 'user-alex-departing',
          recipient_user_id: 'user-maya-recipient-internal',
          title: 'PayPulse Gateway Handover with Gaps',
        });
      expect(resGen.status).toBe(201);
      const planId = resGen.body.id;

      // Fetch clarifications
      const clarifyRes = await request(app)
        .get(`/api/handovers/${planId}/clarifications`)
        .set('x-user-id', 'user-elena-lead');

      expect(clarifyRes.status).toBe(200);
      const questions = clarifyRes.body;
      expect(Array.isArray(questions)).toBe(true);
      expect(questions.length).toBeGreaterThan(0);

      // Verify unowned tasks gap question
      const unownedQ = questions.find((q: any) => q.gap_type === 'unowned_task');
      expect(unownedQ).toBeDefined();
      expect(unownedQ.question).toMatch(/officially assigned|ownership/i);
      expect(unownedQ.suggested_action).toBeDefined();

      // Verify conflicting dates gap question
      const conflictQ = questions.find((q: any) => q.gap_type === 'conflicting_dates');
      expect(conflictQ).toBeDefined();
      expect(conflictQ.question).toMatch(/launch date|timeline/i);
    });
  });

  describe('Recipient Grounded Q&A (Rule 1 & Rule 2 Compliant)', () => {
    it('returns "insufficient evidence" and does not guess when no supporting source exists', async () => {
      // Set up approved handover for Maya
      const resGen = await request(app)
        .post('/api/handovers/generate')
        .send({
          project_id: 'proj-solarpulse-01',
          departing_user_id: 'user-alex-departing',
          recipient_user_id: 'user-maya-recipient-internal',
          title: 'SolarPulse Q&A Handover',
        });
      const planId = resGen.body.id;

      // Maya asks a question completely absent from the source documentation
      const qaRes = await request(app)
        .post(`/api/handovers/${planId}/qa`)
        .set('x-user-id', 'user-maya-recipient-internal')
        .send({
          question: 'What is the secret recipe for quantum microwave popcorn in the cafeteria?',
        });

      expect(qaRes.status).toBe(200);
      expect(qaRes.body.insufficient_evidence).toBe(true);
      expect(qaRes.body.answer).toMatch(/insufficient evidence/i);
      expect(qaRes.body.evidence).toHaveLength(0);
      expect(qaRes.body.verification_status).toBe('unknown');
    });

    it('returns verified answer with exact quotation citation when evidence exists in permitted sources', async () => {
      const resGen = await request(app)
        .post('/api/handovers/generate')
        .send({
          project_id: 'proj-solarpulse-01',
          departing_user_id: 'user-alex-departing',
          recipient_user_id: 'user-maya-recipient-internal',
          title: 'SolarPulse Q&A Handover',
        });
      const planId = resGen.body.id;

      // Maya asks about telemetry and MQTT sensor payloads (authorized internal source RFC-204)
      const qaRes = await request(app)
        .post(`/api/handovers/${planId}/qa`)
        .set('x-user-id', 'user-maya-recipient-internal')
        .send({
          question: 'How often does the telemetry ingestion pipeline process MQTT sensor payloads?',
        });

      expect(qaRes.status).toBe(200);
      expect(qaRes.body.insufficient_evidence).toBe(false);
      expect(qaRes.body.verification_status).toBe('supported');
      expect(qaRes.body.evidence.length).toBeGreaterThan(0);
      expect(qaRes.body.evidence[0].quote).toMatch(/MQTT sensor payloads|60 seconds/i);
      expect(qaRes.body.evidence[0].exact_match).toBe(true);
    });

    it('returns "insufficient evidence" when a public recipient asks about restricted content', async () => {
      const resGen = await request(app)
        .post('/api/handovers/generate')
        .send({
          project_id: 'proj-payments-01',
          departing_user_id: 'user-alex-departing',
          recipient_user_id: 'user-liam-recipient-public',
          title: 'PayPulse Public Handover',
        });
      const planId = resGen.body.id;

      // Liam (Public clearance) asks about restricted Vault encryption keys
      const qaRes = await request(app)
        .post(`/api/handovers/${planId}/qa`)
        .set('x-user-id', 'user-liam-recipient-public')
        .send({
          question: 'Where are the confidential payment vault encryption keys and KMS secrets stored?',
        });

      expect(qaRes.status).toBe(200);
      // Because Liam has public clearance, restricted sources are excluded by Rule 1 pre-filter
      expect(qaRes.body.insufficient_evidence).toBe(true);
      expect(qaRes.body.answer).toMatch(/insufficient evidence/i);
      expect(qaRes.body.evidence).toHaveLength(0);
    });
  });
});
