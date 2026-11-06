import crypto from 'crypto';
import {
  SourceType,
  Passage,
  SourceDocument,
  StructuredIssueExportSchema,
  StructuredMessageExportSchema,
} from '@prasaranam/shared';
import { v4 as uuidv4 } from 'uuid';

export const MAX_SOURCE_BYTES = 2 * 1024 * 1024; // 2MB limit

export function computeContentHash(content: string): string {
  return crypto.createHash('sha256').update(content.trim(), 'utf8').digest('hex');
}

export interface ProcessedSourceContent {
  rawContent: string;
  metadata?: Record<string, any>;
}

/**
 * Validates input size and file type; parses structured JSON exports safely.
 * Malformed JSON returns a clear, safe error and stores nothing.
 */
export function validateAndProcessSourceContent(
  sourceType: SourceType,
  rawInput: string
): ProcessedSourceContent {
  const byteLength = Buffer.byteLength(rawInput, 'utf8');
  if (byteLength > MAX_SOURCE_BYTES) {
    throw new Error(`File size (${(byteLength / 1024).toFixed(1)} KB) exceeds the maximum allowed limit of 2 MB.`);
  }

  if (rawInput.trim().length === 0) {
    throw new Error('Source content cannot be empty.');
  }

  if (sourceType === 'json_export') {
    let parsed: any;
    try {
      parsed = JSON.parse(rawInput);
    } catch (err: any) {
      throw new Error(`Malformed JSON export: ${err.message}. Please provide valid JSON.`, { cause: err });
    }

    // Check if it's an issue export
    const issueResult = StructuredIssueExportSchema.safeParse(parsed);
    if (issueResult.success) {
      const data = issueResult.data;
      const lines: string[] = [];
      lines.push(`Project Issue Export: ${data.project_title || 'Issues'}`);
      if (data.export_date) lines.push(`Export Date: ${data.export_date}`);
      lines.push('');

      for (const issue of data.issues) {
        lines.push(`[${issue.id}] ${issue.title} (Status: ${issue.status || 'open'}, Author: ${issue.author || 'unassigned'})`);
        lines.push(issue.description);
        lines.push('');
      }

      const formattedContent = lines.join('\n').trim();
      return {
        rawContent: formattedContent,
        metadata: {
          format: 'issue_export',
          issue_count: data.issues.length,
          original_json_hash: computeContentHash(rawInput),
        },
      };
    }

    // Check if it's a message export
    const messageResult = StructuredMessageExportSchema.safeParse(parsed);
    if (messageResult.success) {
      const data = messageResult.data;
      const lines: string[] = [];
      lines.push(`Channel Export: ${data.channel || 'General'}`);
      if (data.export_date) lines.push(`Export Date: ${data.export_date}`);
      lines.push('');

      for (const msg of data.messages) {
        const time = msg.timestamp ? ` [${msg.timestamp}]` : '';
        lines.push(`${msg.sender}${time}: ${msg.text}`);
      }

      const formattedContent = lines.join('\n').trim();
      return {
        rawContent: formattedContent,
        metadata: {
          format: 'message_export',
          message_count: data.messages.length,
          original_json_hash: computeContentHash(rawInput),
        },
      };
    }

    // Neither format matched
    throw new Error(
      'Unsupported JSON format. Expected either an issue export ({ format: "issue_export", issues: [...] }) or a message export ({ format: "message_export", messages: [...] }).'
    );
  }

  return { rawContent: rawInput };
}

/**
 * Splits raw source text into stable chunks with exact character offsets.
 * Non-negotiable test requirement: raw_content.slice(char_start, char_end) === text_content exactly!
 */
export function splitIntoVerifiableChunks(
  sourceId: string,
  sourceTitle: string,
  rawContent: string,
  clearance: SourceDocument['clearance_level'] = 'internal'
): Passage[] {
  const passages: Passage[] = [];

  // Split by double newlines or single newlines with non-empty text, preserving exact slice positions
  const regex = /\S[^\n]+(?:\n(?!\n)\S[^\n]+)*/g;
  let match: RegExpExecArray | null;
  let index = 1;

  while ((match = regex.exec(rawContent)) !== null) {
    const textContent = match[0];
    const charStart = match.index;
    const charEnd = charStart + textContent.length;

    // Strict invariant: verify exact character offsets
    if (rawContent.slice(charStart, charEnd) !== textContent) {
      throw new Error(`Chunk offset mismatch for chunk ${index}: offsets [${charStart}..${charEnd}] do not match text slice!`);
    }

    passages.push({
      id: `${sourceId}-chk-${index}-${uuidv4().slice(0, 6)}`,
      source_id: sourceId,
      source_title: sourceTitle,
      passage_index: index,
      text_content: textContent,
      char_start: charStart,
      char_end: charEnd,
      clearance_level: clearance,
    });

    index++;
  }

  // If content was entirely whitespace or single line
  if (passages.length === 0 && rawContent.length > 0) {
    passages.push({
      id: `${sourceId}-chk-1-${uuidv4().slice(0, 6)}`,
      source_id: sourceId,
      source_title: sourceTitle,
      passage_index: 1,
      text_content: rawContent,
      char_start: 0,
      char_end: rawContent.length,
      clearance_level: clearance,
    });
  }

  return passages;
}
