import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../src/db/store.js';
import { canAccessClearance, ClearanceLevel } from '@prasaranam/shared';

describe('Permissions & Pre-Retrieval Filtering (Rule 1)', () => {
  beforeEach(() => {
    db.resetToSeed();
  });

  it('correctly evaluates clearance hierarchy', () => {
    expect(canAccessClearance('public', 'public')).toBe(true);
    expect(canAccessClearance('public', 'internal')).toBe(false);
    expect(canAccessClearance('public', 'confidential')).toBe(false);
    expect(canAccessClearance('public', 'restricted')).toBe(false);

    expect(canAccessClearance('internal', 'public')).toBe(true);
    expect(canAccessClearance('internal', 'internal')).toBe(true);
    expect(canAccessClearance('internal', 'confidential')).toBe(false);
    expect(canAccessClearance('internal', 'restricted')).toBe(false);

    expect(canAccessClearance('confidential', 'internal')).toBe(true);
    expect(canAccessClearance('confidential', 'confidential')).toBe(true);
    expect(canAccessClearance('confidential', 'restricted')).toBe(false);

    expect(canAccessClearance('restricted', 'restricted')).toBe(true);
  });

  it('filters sources BEFORE prompt building based on recipient clearance', () => {
    const projectId = 'proj-solarpulse-01';

    // 1. Guest / Public recipient
    const publicSources = db.getSourcesForRecipient(projectId, 'public');
    expect(publicSources.length).toBe(1);
    expect(publicSources[0].clearance_level).toBe('public');
    expect(publicSources.some(s => s.clearance_level === 'internal')).toBe(false);
    expect(publicSources.some(s => s.clearance_level === 'confidential')).toBe(false);
    expect(publicSources.some(s => s.clearance_level === 'restricted')).toBe(false);

    // 2. Internal recipient (e.g. Maya Patel)
    const internalSources = db.getSourcesForRecipient(projectId, 'internal');
    expect(internalSources.length).toBe(3); // public + 2 internal sources
    for (const s of internalSources) {
      expect(['public', 'internal']).toContain(s.clearance_level);
    }
    // Strict isolation: must NEVER include confidential or restricted documents
    expect(internalSources.some(s => s.clearance_level === 'confidential')).toBe(false);
    expect(internalSources.some(s => s.clearance_level === 'restricted')).toBe(false);

    // 3. Confidential recipient (e.g. Alex Mercer)
    const confidentialSources = db.getSourcesForRecipient(projectId, 'confidential');
    expect(confidentialSources.length).toBe(4);
    expect(confidentialSources.some(s => s.clearance_level === 'restricted')).toBe(false);

    // 4. Restricted recipient (e.g. Elena Rostova, Sarah Chen)
    const restrictedSources = db.getSourcesForRecipient(projectId, 'restricted');
    expect(restrictedSources.length).toBe(5);
  });

  it('ensures passages retrieved for recipient contain zero restricted content', () => {
    const projectId = 'proj-solarpulse-01';
    const recipientClearance: ClearanceLevel = 'internal';

    const passages = db.getPassagesForRecipient(projectId, recipientClearance);

    // Check every single passage returned
    for (const passage of passages) {
      expect(['public', 'internal']).toContain(passage.clearance_level);
      expect(passage.text_content).not.toContain('HSM Root Key Custody');
      expect(passage.text_content).not.toContain('LithiumCell batch LC-8890');
    }
  });
});

