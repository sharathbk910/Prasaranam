import { z } from 'zod';

export const ClearanceLevelEnum = z.enum(['public', 'internal', 'confidential', 'restricted']);
export type ClearanceLevel = z.infer<typeof ClearanceLevelEnum>;

export const ClearanceHierarchy: Record<ClearanceLevel, number> = {
  public: 1,
  internal: 2,
  confidential: 3,
  restricted: 4,
};

export function canAccessClearance(userClearance: ClearanceLevel, itemClearance: ClearanceLevel): boolean {
  return ClearanceHierarchy[userClearance] >= ClearanceHierarchy[itemClearance];
}

export const VerificationStatusEnum = z.enum([
  'supported',
  'corroborated',
  'needs confirmation',
  'conflicting',
  'unknown'
]);
export type VerificationStatus = z.infer<typeof VerificationStatusEnum>;

export const HandoverStatusEnum = z.enum([
  'draft',
  'under_review',
  'changes_requested',
  'approved',
  'shared'
]);
export type HandoverStatus = z.infer<typeof HandoverStatusEnum>;

export const SourceTypeEnum = z.enum([
  'chat',
  'email',
  'doc',
  'ticket',
  'meeting_notes',
  'pasted_text',
  'markdown',
  'json_export'
]);
export type SourceType = z.infer<typeof SourceTypeEnum>;

export const SourceVisibilityEnum = z.enum(['all_members', 'restricted_members']);
export type SourceVisibility = z.infer<typeof SourceVisibilityEnum>;

export const UserRoleEnum = z.enum(['admin', 'reviewer', 'member', 'guest']);
export type UserRole = z.infer<typeof UserRoleEnum>;

export const MembershipRoleEnum = z.enum(['owner', 'admin', 'member', 'viewer']);
export type MembershipRole = z.infer<typeof MembershipRoleEnum>;

// Phase 3: Structured Knowledge Item Types
export const KnowledgeItemTypeEnum = z.enum([
  'decision',
  'task',
  'blocker',
  'risk',
  'dependency',
  'open_question',
  'owner_assignment'
]);
export type KnowledgeItemType = z.infer<typeof KnowledgeItemTypeEnum>;

// Phase 3: Extraction Job Status
export const ExtractionJobStatusEnum = z.enum([
  'queued',
  'running',
  'completed',
  'failed'
]);
export type ExtractionJobStatus = z.infer<typeof ExtractionJobStatusEnum>;

export const WorkspaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  created_by: z.string(),
  created_at: z.string(),
});
export type Workspace = z.infer<typeof WorkspaceSchema>;

export const MembershipSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  workspace_id: z.string().optional(),
  project_id: z.string(),
  role: MembershipRoleEnum,
  created_at: z.string(),
});
export type Membership = z.infer<typeof MembershipSchema>;

export const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  role: UserRoleEnum,
  clearance_level: ClearanceLevelEnum,
  avatar_url: z.string().optional(),
});
export type User = z.infer<typeof UserSchema>;

export const ProjectSchema = z.object({
  id: z.string(),
  workspace_id: z.string().optional(),
  name: z.string(),
  description: z.string(),
  lead_id: z.string(),
  created_by: z.string().optional(),
  created_at: z.string(),
});
export type Project = z.infer<typeof ProjectSchema>;

export const CreateProjectRequestSchema = z.object({
  name: z.string().min(2, 'Project name must be at least 2 characters'),
  description: z.string().min(5, 'Description must be at least 5 characters'),
  workspace_id: z.string().optional(),
});
export type CreateProjectRequest = z.infer<typeof CreateProjectRequestSchema>;

export const AuthCredentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().optional(),
});
export type AuthCredentials = z.infer<typeof AuthCredentialsSchema>;

export const PassageSchema = z.object({
  id: z.string(),
  source_id: z.string(),
  source_title: z.string(),
  passage_index: z.number(),
  text_content: z.string(),
  char_start: z.number(),
  char_end: z.number(),
  clearance_level: ClearanceLevelEnum.default('internal'),
});
export type Passage = z.infer<typeof PassageSchema>;

export const SourceDocumentSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  title: z.string(),
  source_type: SourceTypeEnum,
  clearance_level: ClearanceLevelEnum.default('internal'),
  author: z.string(),
  date: z.string().optional(),
  imported_at: z.string(),
  raw_content: z.string(),
  content_hash: z.string(),
  visibility: SourceVisibilityEnum.default('all_members'),
  allowed_member_ids: z.array(z.string()).default([]),
  uploader_id: z.string().optional(),
  passages: z.array(PassageSchema).default([]),
  metadata: z.record(z.any()).optional(),
});
export type SourceDocument = z.infer<typeof SourceDocumentSchema>;

export const ImportSourceInputSchema = z.object({
  project_id: z.string(),
  title: z.string().min(2, 'Title must be at least 2 characters'),
  author: z.string().min(2, 'Author must be specified'),
  date: z.string().optional(),
  source_type: SourceTypeEnum,
  raw_content: z.string().min(5, 'Content must be at least 5 characters'),
  visibility: SourceVisibilityEnum.default('all_members'),
  allowed_member_ids: z.array(z.string()).default([]),
  clearance_level: ClearanceLevelEnum.optional().default('internal'),
});
export type ImportSourceInput = z.infer<typeof ImportSourceInputSchema>;

export const StructuredIssueItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  author: z.string().optional(),
  status: z.string().optional(),
  created_at: z.string().optional(),
});

export const StructuredIssueExportSchema = z.object({
  format: z.literal('issue_export'),
  project_title: z.string().optional(),
  export_date: z.string().optional(),
  issues: z.array(StructuredIssueItemSchema).min(1, 'Export must contain at least one issue'),
});
export type StructuredIssueExport = z.infer<typeof StructuredIssueExportSchema>;

export const StructuredMessageItemSchema = z.object({
  sender: z.string(),
  text: z.string(),
  timestamp: z.string().optional(),
});

export const StructuredMessageExportSchema = z.object({
  format: z.literal('message_export'),
  channel: z.string().optional(),
  export_date: z.string().optional(),
  messages: z.array(StructuredMessageItemSchema).min(1, 'Export must contain at least one message'),
});
export type StructuredMessageExport = z.infer<typeof StructuredMessageExportSchema>;

export const SearchResultSchema = z.object({
  passage_id: z.string(),
  source_id: z.string(),
  source_title: z.string(),
  author: z.string(),
  date: z.string(),
  char_start: z.number(),
  char_end: z.number(),
  text_content: z.string(),
  snippet: z.string(),
  clearance_level: ClearanceLevelEnum,
  visibility: SourceVisibilityEnum,
});
export type SearchResult = z.infer<typeof SearchResultSchema>;

export const HandoverSectionEnum = z.enum([
  'project_snapshot',
  'decisions_rationale',
  'work_in_progress',
  'blockers',
  'dependencies',
  'risks',
  'owners_contacts',
  'unresolved_questions',
  'suggested_next_actions',
]);
export type HandoverSection = z.infer<typeof HandoverSectionEnum>;

export const QuotationEvidenceSchema = z.object({
  passage_id: z.string(),
  source_title: z.string(),
  quote: z.string(),
  exact_match: z.boolean(),
  char_offset: z.number().optional(),
  is_source_accessible: z.boolean().default(true).optional(),
  source_author: z.string().optional(),
  source_date: z.string().optional(),
  source_clearance: ClearanceLevelEnum.optional(),
});
export type QuotationEvidence = z.infer<typeof QuotationEvidenceSchema>;

export const ReviewerContextSchema = z.object({
  reviewer_id: z.string(),
  reviewer_name: z.string(),
  edited_at: z.string(),
  original_statement: z.string().optional(),
  reviewer_rationale: z.string().optional(),
});
export type ReviewerContext = z.infer<typeof ReviewerContextSchema>;

export const HandoverItemSchema = z.object({
  id: z.string(),
  handover_id: z.string(),
  item_type: KnowledgeItemTypeEnum.default('decision'),
  section: HandoverSectionEnum.default('project_snapshot'),
  topic: z.string(),
  statement: z.string(),
  verification_status: VerificationStatusEnum,
  owner: z.string().nullable(),
  is_owner_explicit: z.boolean().default(false),
  is_suggestion: z.boolean().default(false),
  quotations: z.array(QuotationEvidenceSchema),
  is_fallback: z.boolean().default(false),
  reviewer_status: z.enum(['pending', 'approved', 'rejected', 'edited', 'accepted', 'flagged', 'modified']).default('pending'),
  reviewer_notes: z.string().optional(),
  reviewer_context: ReviewerContextSchema.optional(),
});
export type HandoverItem = z.infer<typeof HandoverItemSchema>;

export const AuditLogEntrySchema = z.object({
  id: z.string(),
  action: z.string(),
  performed_by: z.string(),
  timestamp: z.string(),
  details: z.string(),
});
export type AuditLogEntry = z.infer<typeof AuditLogEntrySchema>;

export const HandoverPlanSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  project_name: z.string(),
  title: z.string(),
  summary: z.string(),
  departing_user_id: z.string(),
  departing_user_name: z.string(),
  recipient_user_id: z.string(),
  recipient_user_name: z.string(),
  recipient_clearance: ClearanceLevelEnum,
  reviewer_user_id: z.string().nullable(),
  reviewer_user_name: z.string().nullable().optional(),
  status: HandoverStatusEnum,
  generated_with_fallback: z.boolean(),
  version_number: z.number().default(1),
  is_stale: z.boolean().default(false),
  stale_reason: z.string().nullable().optional(),
  parent_approved_version_id: z.string().nullable().optional(),
  items: z.array(HandoverItemSchema),
  audit_logs: z.array(AuditLogEntrySchema),
  approved_at: z.string().optional(),
  reviewer_notes: z.string().optional(),
  acknowledged_at: z.string().optional(),
  acknowledged_by: z.string().optional(),
  acknowledged_notes: z.string().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type HandoverPlan = z.infer<typeof HandoverPlanSchema>;

export const AcknowledgeHandoverRequestSchema = z.object({
  notes: z.string().optional(),
  acknowledged_by_name: z.string().optional(),
});
export type AcknowledgeHandoverRequest = z.infer<typeof AcknowledgeHandoverRequestSchema>;

export const ExtractionJobSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  project_name: z.string(),
  status: ExtractionJobStatusEnum,
  progress_pct: z.number().min(0).max(100),
  error_message: z.string().nullable().optional(),
  is_fallback: z.boolean().default(false),
  items_count: z.number().default(0),
  handover_id: z.string().nullable().optional(),
  created_at: z.string(),
  completed_at: z.string().nullable().optional(),
});
export type ExtractionJob = z.infer<typeof ExtractionJobSchema>;

export const StartExtractionRequestSchema = z.object({
  project_id: z.string(),
  force_fallback: z.boolean().optional(),
  title: z.string().optional(),
});
export type StartExtractionRequest = z.infer<typeof StartExtractionRequestSchema>;

export const GenerateHandoverRequestSchema = z.object({
  project_id: z.string(),
  departing_user_id: z.string(),
  recipient_user_id: z.string(),
  reviewer_user_id: z.string().optional(),
  title: z.string().min(3),
  instructions: z.string().optional(),
  selected_sections: z.array(HandoverSectionEnum).optional(),
});
export type GenerateHandoverRequest = z.infer<typeof GenerateHandoverRequestSchema>;

export const ReviewActionSchema = z.object({
  handover_id: z.string(),
  action: z.enum([
    'approve',
    'request_changes',
    'update_item',
    'share',
    'approve_item',
    'reject_item',
    'edit_item',
  ]),
  item_id: z.string().optional(),
  item_patch: HandoverItemSchema.partial().optional(),
  edited_statement: z.string().optional(),
  comment: z.string().optional(),
  reviewer_name: z.string().optional(),
});
export type ReviewAction = z.infer<typeof ReviewActionSchema>;

// --- Phase 6: Clarifications, Grounded Q&A, Redacted Audit Logs ---
export const ClarificationQuestionSchema = z.object({
  id: z.string(),
  gap_item_id: z.string(),
  gap_type: z.enum(['missing_rationale', 'unowned_task', 'conflicting_dates']),
  topic: z.string(),
  question: z.string(),
  suggested_action: z.string(),
});
export type ClarificationQuestion = z.infer<typeof ClarificationQuestionSchema>;

export const QuestionAnswerRequestSchema = z.object({
  question: z.string().min(2, 'Question too short').max(500, 'Question too long'),
});
export type QuestionAnswerRequest = z.infer<typeof QuestionAnswerRequestSchema>;

export const QuestionAnswerResponseSchema = z.object({
  question: z.string(),
  answer: z.string(),
  insufficient_evidence: z.boolean(),
  verification_status: VerificationStatusEnum,
  evidence: z.array(QuotationEvidenceSchema),
  is_fallback: z.boolean().default(false),
});
export type QuestionAnswerResponse = z.infer<typeof QuestionAnswerResponseSchema>;

export const RedactedAuditLogEntrySchema = z.object({
  id: z.string(),
  action: z.string(),
  performed_by: z.string(),
  timestamp: z.string(),
  details: z.string(),
  redacted: z.boolean().default(true),
});
export type RedactedAuditLogEntry = z.infer<typeof RedactedAuditLogEntrySchema>;

