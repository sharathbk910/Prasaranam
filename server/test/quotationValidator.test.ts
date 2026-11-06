import { describe, it, expect } from 'vitest';
import {
  verifyQuotation,
  verifyOwnershipAssignment,
  sanitizeVerificationStatus,
  validateAndEnforceItemRules,
} from '../src/services/quotationValidator.js';
import { Passage } from '@prasaranam/shared';

describe('Quotation Validator & Rule Enforcer', () => {
  describe('Rule 4: Quotation Exact Substring Verification', () => {
    const passageText = 'The ingestion pipeline processes MQTT sensor payloads from remote clinics every 60 seconds.';

    it('confirms exact verbatim quotation', () => {
      const quote = 'MQTT sensor payloads from remote clinics';
      const result = verifyQuotation(quote, passageText);
      expect(result.exactMatch).toBe(true);
      expect(result.charOffset).toBe(33);
    });

    it('confirms quotation with whitespace normalization', () => {
      const quote = 'processes   MQTT sensor   payloads';
      const result = verifyQuotation(quote, passageText);
      expect(result.exactMatch).toBe(true);
    });

    it('rejects hallucinated or modified quotation', () => {
      const quote = 'MQTT sensor payloads from rural hospitals every 30 seconds';
      const result = verifyQuotation(quote, passageText);
      expect(result.exactMatch).toBe(false);
    });

    it('rejects empty quotation or empty passage', () => {
      expect(verifyQuotation('', passageText).exactMatch).toBe(false);
      expect(verifyQuotation('some quote', '').exactMatch).toBe(false);
    });
  });

  describe('Rule 5: Authorship vs Ownership Distinction', () => {
    it('does NOT infer ownership from message authorship or dialogue', () => {
      const chatTranscripts = [
        'Liam Vance [10:17 AM]: Should I take over the database backup validation scripts?',
        'Alex Mercer [10:22 AM]: Note that the staging Redis cache occasionally reports timeout errors.',
      ];

      // Claiming Liam Vance as owner based on asking in chat should be REJECTED per Rule 5
      const resultLiam = verifyOwnershipAssignment('Liam Vance', chatTranscripts);
      expect(resultLiam.verifiedOwner).toBeNull();
      expect(resultLiam.isExplicit).toBe(false);

      // Claiming Alex Mercer as owner based on reporting a note should be REJECTED per Rule 5
      const resultAlex = verifyOwnershipAssignment('Alex Mercer', chatTranscripts);
      expect(resultAlex.verifiedOwner).toBeNull();
      expect(resultAlex.isExplicit).toBe(false);
    });

    it('accepts owner ONLY when an explicit assignment is established in the source text', () => {
      const passages = [
        'Elena Rostova [10:20 AM]: No, Liam will focus on frontend data tables. Maya Patel is assigned ownership of the database backup scripts.',
        'Elena Rostova formally assigned system maintenance of the telemetry parser to Maya Patel in ticket SEC-402.',
      ];

      const result = verifyOwnershipAssignment('Maya Patel', passages);
      expect(result.verifiedOwner).toBe('Maya Patel');
      expect(result.isExplicit).toBe(true);
    });
  });

  describe('Rule 6: Verification Status Labels (No Percentages)', () => {
    it('accepts valid labels', () => {
      expect(sanitizeVerificationStatus('supported')).toBe('supported');
      expect(sanitizeVerificationStatus('corroborated')).toBe('corroborated');
      expect(sanitizeVerificationStatus('needs confirmation')).toBe('needs confirmation');
      expect(sanitizeVerificationStatus('conflicting')).toBe('conflicting');
      expect(sanitizeVerificationStatus('unknown')).toBe('unknown');
    });

    it('rejects percentage numbers and falls back to needs confirmation', () => {
      expect(sanitizeVerificationStatus('95%')).toBe('needs confirmation');
      expect(sanitizeVerificationStatus('0.85 confidence')).toBe('needs confirmation');
      expect(sanitizeVerificationStatus('high probability')).toBe('needs confirmation');
    });
  });

  describe('Full Item Rule Enforcement', () => {
    const mockPassage: Passage = {
      id: 'p-1',
      source_id: 'src-1',
      source_title: 'RFC-204',
      passage_index: 1,
      text_content: 'If the MQTT broker loses connection, an on-device SQLite buffer holds up to 48 hours of sensor readings.',
      char_start: 0,
      char_end: 104,
      clearance_level: 'internal',
    };
    const passagesMap = new Map([['p-1', mockPassage]]);

    it('enforces rules on a valid raw item', () => {
      const raw = {
        topic: 'Buffer Tolerance',
        statement: 'Offline buffer stores 48h of sensor readings during broker disconnects.',
        verification_status: 'supported',
        quotations: [
          {
            passage_id: 'p-1',
            quote: 'an on-device SQLite buffer holds up to 48 hours of sensor readings',
          },
        ],
      };

      const result = validateAndEnforceItemRules(raw, 'handover-123', 'item-1', passagesMap, false);
      expect(result.valid).toBe(true);
      expect(result.item.quotations[0].exact_match).toBe(true);
      expect(result.item.verification_status).toBe('supported');
    });

    it('flags item when quotation does not match source', () => {
      const raw = {
        topic: 'Buffer Tolerance',
        statement: 'Offline buffer stores 72h.',
        verification_status: 'supported',
        quotations: [
          {
            passage_id: 'p-1',
            quote: 'buffer holds up to 72 hours of sensor readings', // Hallucinated 72 hours!
          },
        ],
      };

      const result = validateAndEnforceItemRules(raw, 'handover-123', 'item-1', passagesMap, false);
      expect(result.valid).toBe(false);
      expect(result.item.quotations[0].exact_match).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});
