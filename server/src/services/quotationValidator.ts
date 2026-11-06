import {
  Passage,
  HandoverItem,
  QuotationEvidence,
  VerificationStatus,
  VerificationStatusEnum,
  KnowledgeItemType,
  HandoverSection,
} from '@prasaranam/shared';

export interface RawAIItem {
  item_type?: KnowledgeItemType;
  topic: string;
  statement: string;
  verification_status: string;
  owner?: string | null;
  is_owner_explicit?: boolean;
  quotations: Array<{
    passage_id: string;
    quote: string;
  }>;
  notes?: string;
}

export interface ValidationResult {
  valid: boolean;
  item: HandoverItem;
  errors: string[];
}

/**
 * Normalizes text for comparison (whitespace normalization, trimming)
 */
export function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Validates whether a quotation is an exact substring of the referenced passage.
 * Rule 4: The server validates that each quotation matches its source exactly.
 */
export function verifyQuotation(quote: string, passageText: string): { exactMatch: boolean; charOffset?: number } {
  if (!quote || !passageText) {
    return { exactMatch: false };
  }

  // Exact verbatim match check
  const exactIndex = passageText.indexOf(quote);
  if (exactIndex !== -1) {
    return { exactMatch: true, charOffset: exactIndex };
  }

  // Normalized whitespace match check
  const normQuote = normalizeText(quote);
  const normPassage = normalizeText(passageText);
  const normIndex = normPassage.indexOf(normQuote);
  if (normIndex !== -1) {
    return { exactMatch: true, charOffset: normIndex };
  }

  return { exactMatch: false };
}

/**
 * Rule 5: Do not infer an owner from message authorship.
 * Show an owner only when a source explicitly establishes the assignment.
 */
const EXPLICIT_ASSIGNMENT_PATTERNS = [
  /assigned\s+(?:ownership\s+of\s+.*?\s+to|to)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
  /assigned\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:as\s+owner|to\s+own|to\s+maintain)/i,
  /ownership\s+transferred\s+to\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
  /designated\s+owner:\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
  /formally\s+assigned\s+.*?\s+to\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
];

export function verifyOwnershipAssignment(claimedOwner: string | null | undefined, passageTexts: string[]): {
  verifiedOwner: string | null;
  isExplicit: boolean;
} {
  if (!claimedOwner || claimedOwner.trim() === '') {
    return { verifiedOwner: null, isExplicit: false };
  }

  const trimmed = claimedOwner.trim();
  const allText = passageTexts.join(' \n ');

  // Rule 5: Check if any passage explicitly assigns this person
  const hasExplicitAssignment = EXPLICIT_ASSIGNMENT_PATTERNS.some(regex => {
    const match = allText.match(regex);
    if (match && match[1]) {
      return match[1].toLowerCase().includes(trimmed.toLowerCase()) || trimmed.toLowerCase().includes(match[1].toLowerCase());
    }
    return false;
  });

  if (hasExplicitAssignment) {
    return { verifiedOwner: trimmed, isExplicit: true };
  }

  // If claimed owner is merely a speaker/author in chat (e.g. "Liam Vance [10:17 AM]: Should I...")
  // but NO explicit assignment was made, wipe owner to null!
  return { verifiedOwner: null, isExplicit: false };
}

/**
 * Rule 6: Validate verification label.
 * Do not show confidence percentages. Must be one of the enum values.
 */
export function sanitizeVerificationStatus(status: string): VerificationStatus {
  const normalized = status.toLowerCase().trim();
  const parsed = VerificationStatusEnum.safeParse(normalized);
  if (parsed.success) {
    return parsed.data;
  }
  // Default to needs confirmation if unrecognized
  return 'needs confirmation';
}

/**
 * Validates a single handover item produced by AI or fallback.
 */
export function validateAndEnforceItemRules(
  raw: RawAIItem,
  handoverId: string,
  itemId: string,
  authorizedPassagesMap: Map<string, Passage>,
  isFallback: boolean = false
): ValidationResult {
  const errors: string[] = [];
  const verifiedQuotations: QuotationEvidence[] = [];
  const referencedPassageTexts: string[] = [];

  // Check referenced passages and verify quotations
  for (const q of raw.quotations || []) {
    const passage = authorizedPassagesMap.get(q.passage_id);
    if (!passage) {
      errors.push(`Referenced passage ID "${q.passage_id}" does not exist in recipient-authorized sources.`);
      continue;
    }

    referencedPassageTexts.push(passage.text_content);
    const check = verifyQuotation(q.quote, passage.text_content);

    if (!check.exactMatch) {
      errors.push(`Quotation "${q.quote}" is not an exact match in passage "${q.passage_id}".`);
    }

    verifiedQuotations.push({
      passage_id: passage.id,
      source_title: passage.source_title,
      quote: q.quote,
      exact_match: check.exactMatch,
      char_offset: check.charOffset,
    });
  }

  // Rule 5: Verify owner assignment
  const { verifiedOwner, isExplicit } = verifyOwnershipAssignment(raw.owner, referencedPassageTexts);

  // Rule 6: Verification status label
  const status = sanitizeVerificationStatus(raw.verification_status);

  const isSuggestion = raw.statement.toLowerCase().includes('suggest') || raw.statement.toLowerCase().includes('recommend');
  let itemSection: HandoverSection = 'project_snapshot';
  if (isSuggestion) {
    itemSection = 'suggested_next_actions';
  } else if (raw.item_type === 'decision') {
    itemSection = 'decisions_rationale';
  } else if (raw.item_type === 'task') {
    itemSection = 'work_in_progress';
  } else if (raw.item_type === 'blocker') {
    itemSection = 'blockers';
  } else if (raw.item_type === 'risk') {
    itemSection = 'risks';
  } else if (raw.item_type === 'dependency') {
    itemSection = 'dependencies';
  } else if (raw.item_type === 'owner_assignment') {
    itemSection = 'owners_contacts';
  } else if (raw.item_type === 'open_question' || status === 'unknown') {
    itemSection = 'unresolved_questions';
  }

  const item: HandoverItem = {
    id: itemId,
    handover_id: handoverId,
    item_type: raw.item_type || 'decision',
    section: itemSection,
    topic: raw.topic.trim(),
    statement: raw.statement.trim(),
    verification_status: status,
    owner: verifiedOwner,
    is_owner_explicit: isExplicit,
    is_suggestion: isSuggestion,
    quotations: verifiedQuotations,
    is_fallback: isFallback,
    reviewer_status: 'pending',
    reviewer_notes: raw.notes,
  };

  return {
    valid: errors.length === 0,
    item,
    errors,
  };
}

