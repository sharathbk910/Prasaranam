import {
  User,
  Project,
  Workspace,
  Membership,
  SourceDocument,
  Passage,
  HandoverPlan,
  HandoverItem,
  AuditLogEntry,
  ClearanceLevel,
  canAccessClearance,
  ImportSourceInput,
  SearchResult,
  ClarificationQuestion,
  QuestionAnswerResponse,
  RedactedAuditLogEntry,
  QuotationEvidence,
} from '@prasaranam/shared';
import { SEED_USERS, SEED_PROJECTS, buildSeedSources } from './seedData.js';
import { v4 as uuidv4 } from 'uuid';
import {
  computeContentHash,
  validateAndProcessSourceContent,
  splitIntoVerifiableChunks,
} from '../services/sourceImporter.js';
import { verifyQuotation } from '../services/quotationValidator.js';
import { generateDeterministicFallback } from '../services/deterministicFallback.js';

export interface StoredSession {
  token: string;
  user_id: string;
  created_at: string;
  expires_at: string;
}

export interface IngestResult {
  source: SourceDocument;
  isDuplicate: boolean;
}

class DatabaseStore {
  private users: Map<string, User> = new Map();
  private userPasswords: Map<string, string> = new Map();
  private sessions: Map<string, StoredSession> = new Map();
  private workspaces: Map<string, Workspace> = new Map();
  private projects: Map<string, Project> = new Map();
  private memberships: Map<string, Membership> = new Map();
  private sources: Map<string, SourceDocument> = new Map();
  private passages: Map<string, Passage> = new Map();
  private handovers: Map<string, HandoverPlan> = new Map();
  private approvedVersions: Map<string, HandoverPlan> = new Map();

  constructor() {
    this.resetToSeed();
  }

  public resetToSeed(): void {
    this.users.clear();
    this.userPasswords.clear();
    this.sessions.clear();
    this.workspaces.clear();
    this.projects.clear();
    this.memberships.clear();
    this.sources.clear();
    this.passages.clear();
    this.handovers.clear();
    this.approvedVersions.clear();

    const defaultWorkspace: Workspace = {
      id: 'ws-solarpulse-main',
      name: 'SolarPulse Open Infrastructure',
      created_by: 'user-elena-lead',
      created_at: '2026-01-01T00:00:00Z',
    };
    this.workspaces.set(defaultWorkspace.id, defaultWorkspace);

    for (const u of SEED_USERS) {
      this.users.set(u.id, u);
      this.userPasswords.set(u.email.toLowerCase(), 'Pass1234!');
    }

    for (const p of SEED_PROJECTS) {
      const projWithWs: Project = {
        ...p,
        workspace_id: defaultWorkspace.id,
        created_by: p.lead_id,
      };
      this.projects.set(p.id, projWithWs);
    }

    this.addMembershipInternal('user-elena-lead', 'proj-solarpulse-01', 'owner', defaultWorkspace.id);
    this.addMembershipInternal('user-alex-departing', 'proj-solarpulse-01', 'admin', defaultWorkspace.id);
    this.addMembershipInternal('user-maya-recipient-internal', 'proj-solarpulse-01', 'member', defaultWorkspace.id);
    this.addMembershipInternal('user-sarah-reviewer', 'proj-solarpulse-01', 'admin', defaultWorkspace.id);
    this.addMembershipInternal('user-liam-recipient-public', 'proj-solarpulse-01', 'viewer', defaultWorkspace.id);

    // Phase 3 Payments Gateway project memberships
    this.addMembershipInternal('user-elena-lead', 'proj-payments-01', 'owner', defaultWorkspace.id);
    this.addMembershipInternal('user-alex-departing', 'proj-payments-01', 'admin', defaultWorkspace.id);
    this.addMembershipInternal('user-maya-recipient-internal', 'proj-payments-01', 'member', defaultWorkspace.id);
    this.addMembershipInternal('user-sarah-reviewer', 'proj-payments-01', 'admin', defaultWorkspace.id);
    this.addMembershipInternal('user-liam-recipient-public', 'proj-payments-01', 'viewer', defaultWorkspace.id);

    const seedSources = buildSeedSources();
    for (const s of seedSources) {
      const hash = computeContentHash(s.raw_content);
      const docWithHash: SourceDocument = {
        ...s,
        content_hash: hash,
        visibility: s.clearance_level === 'restricted' ? 'restricted_members' : 'all_members',
        allowed_member_ids: s.clearance_level === 'restricted' ? ['user-elena-lead', 'user-sarah-reviewer'] : [],
        date: s.imported_at,
        uploader_id: 'user-elena-lead',
      };
      this.sources.set(docWithHash.id, docWithHash);
      for (const p of s.passages) {
        this.passages.set(p.id, p);
      }
    }

    // Seed approved & shared handover for Maya Patel
    const passagesForMaya = this.getPassagesForRecipient('proj-solarpulse-01', 'internal');
    const fallbackMaya = generateDeterministicFallback(
      'plan-solarpulse-approved-maya',
      'Alex Mercer',
      'Maya Patel',
      passagesForMaya
    );

    const seededMayaPlan: HandoverPlan = {
      id: 'plan-solarpulse-approved-maya',
      project_id: 'proj-solarpulse-01',
      project_name: 'Project SolarPulse',
      departing_user_id: 'user-alex-departing',
      departing_user_name: 'Alex Mercer',
      recipient_user_id: 'user-maya-recipient-internal',
      recipient_user_name: 'Maya Patel',
      recipient_clearance: 'internal',
      reviewer_user_id: 'user-sarah-reviewer',
      reviewer_user_name: 'Sarah Chen (Lead Reviewer)',
      title: 'SolarPulse Operational Handover (Maya Patel)',
      summary: fallbackMaya.summary,
      status: 'approved',
      version_number: 1,
      is_stale: false,
      generated_with_fallback: true,
      items: fallbackMaya.items.map(it => ({
        ...it,
        reviewer_status: 'approved' as const,
        reviewer_notes: 'Verified against authorized passage during seed initialization.',
      })),
      audit_logs: [
        {
          id: 'audit-seed-01',
          action: 'APPROVED',
          performed_by: 'Sarah Chen (Lead Reviewer)',
          timestamp: '2026-03-01T10:00:00Z',
          details: 'Approved by lead reviewer Sarah Chen after verifying evidence citations.',
        },
        {
          id: 'audit-seed-02',
          action: 'SHARED',
          performed_by: 'Sarah Chen (Lead Reviewer)',
          timestamp: '2026-03-01T10:05:00Z',
          details: 'Shared with recipient Maya Patel.',
        },
      ],
      created_at: '2026-03-01T09:30:00Z',
      updated_at: '2026-03-01T10:05:00Z',
      approved_at: '2026-03-01T10:00:00Z',
    };

    this.saveHandover(seededMayaPlan);
  }

  // --- Auth ---
  public signUp(email: string, password: string, name?: string): { user: User; token: string } {
    const normalizedEmail = email.toLowerCase().trim();
    if (this.findUserByEmail(normalizedEmail)) {
      throw new Error('User with this email already exists.');
    }

    const userId = `user-${uuidv4().slice(0, 8)}`;
    const user: User = {
      id: userId,
      name: name || normalizedEmail.split('@')[0],
      email: normalizedEmail,
      role: 'member',
      clearance_level: 'internal',
    };

    this.users.set(userId, user);
    this.userPasswords.set(normalizedEmail, password);

    const workspace: Workspace = {
      id: `ws-${uuidv4().slice(0, 8)}`,
      name: `${user.name}'s Workspace`,
      created_by: userId,
      created_at: new Date().toISOString(),
    };
    this.workspaces.set(workspace.id, workspace);

    const token = `token-${uuidv4()}`;
    const session: StoredSession = {
      token,
      user_id: userId,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };
    this.sessions.set(token, session);

    return { user, token };
  }

  public signIn(email: string, password: string): { user: User; token: string } {
    const normalizedEmail = email.toLowerCase().trim();
    const user = this.findUserByEmail(normalizedEmail);
    if (!user) throw new Error('Invalid email or password.');

    const storedPass = this.userPasswords.get(normalizedEmail);
    if (!storedPass || storedPass !== password) {
      throw new Error('Invalid email or password.');
    }

    const token = `token-${uuidv4()}`;
    const session: StoredSession = {
      token,
      user_id: user.id,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };
    this.sessions.set(token, session);

    return { user, token };
  }

  public signOut(token: string): boolean {
    return this.sessions.delete(token);
  }

  public getUserByToken(token: string): User | undefined {
    const session = this.sessions.get(token);
    if (!session) return undefined;
    return this.users.get(session.user_id);
  }

  public findUserByEmail(email: string): User | undefined {
    const normalized = email.toLowerCase().trim();
    return Array.from(this.users.values()).find(u => u.email.toLowerCase() === normalized);
  }

  public getUsers(): User[] {
    return Array.from(this.users.values());
  }

  public getUser(id: string): User | undefined {
    return this.users.get(id);
  }

  // --- Workspaces & Projects ---
  public getWorkspacesForUser(userId: string): Workspace[] {
    return Array.from(this.workspaces.values()).filter(w => {
      if (w.created_by === userId) return true;
      return Array.from(this.memberships.values()).some(
        m => m.user_id === userId && m.workspace_id === w.id
      );
    });
  }

  public createWorkspace(name: string, userId: string): Workspace {
    const ws: Workspace = {
      id: `ws-${uuidv4().slice(0, 8)}`,
      name: name.trim(),
      created_by: userId,
      created_at: new Date().toISOString(),
    };
    this.workspaces.set(ws.id, ws);
    return ws;
  }

  public getProjectsForUser(userId: string): Project[] {
    return Array.from(this.projects.values()).filter(p => {
      if (p.created_by === userId || p.lead_id === userId) return true;
      return this.isMemberOfProject(userId, p.id);
    });
  }

  public getProjectForUser(projectId: string, userId: string): Project | undefined {
    const project = this.projects.get(projectId);
    if (!project) return undefined;
    if (project.created_by === userId || project.lead_id === userId || this.isMemberOfProject(userId, projectId)) {
      return project;
    }
    return undefined;
  }

  public getProject(id: string): Project | undefined {
    return this.projects.get(id);
  }

  public createProject(name: string, description: string, userId: string, workspaceId?: string): Project {
    const userWorkspaces = this.getWorkspacesForUser(userId);
    const assignedWorkspaceId = workspaceId || (userWorkspaces.length > 0 ? userWorkspaces[0].id : undefined);

    const project: Project = {
      id: `proj-${uuidv4().slice(0, 8)}`,
      workspace_id: assignedWorkspaceId,
      name: name.trim(),
      description: description.trim(),
      lead_id: userId,
      created_by: userId,
      created_at: new Date().toISOString(),
    };

    this.projects.set(project.id, project);
    this.addMembershipInternal(userId, project.id, 'owner', assignedWorkspaceId);
    return project;
  }

  public isMemberOfProject(userId: string, projectId: string): boolean {
    return Array.from(this.memberships.values()).some(
      m => m.user_id === userId && m.project_id === projectId
    );
  }

  public removeMembership(userId: string, projectId: string): boolean {
    const key = `${userId}:${projectId}`;
    return this.memberships.delete(key);
  }

  public getMembershipsForProject(projectId: string): Array<Membership & { user: User }> {
    return Array.from(this.memberships.values())
      .filter(m => m.project_id === projectId)
      .map(m => ({
        ...m,
        user: this.users.get(m.user_id)!,
      }))
      .filter(m => Boolean(m.user));
  }

  public addMembership(userId: string, projectId: string, role: Membership['role'], workspaceId?: string): Membership {
    return this.addMembershipInternal(userId, projectId, role, workspaceId);
  }

  private addMembershipInternal(userId: string, projectId: string, role: Membership['role'], workspaceId?: string): Membership {
    const key = `${userId}:${projectId}`;
    const membership: Membership = {
      id: `mem-${uuidv4().slice(0, 8)}`,
      user_id: userId,
      project_id: projectId,
      workspace_id: workspaceId,
      role,
      created_at: new Date().toISOString(),
    };
    this.memberships.set(key, membership);
    return membership;
  }

  // --- Phase 2: Authorised Source Ingestion, Hash Deduplication & Chunking ---
  public importSource(input: ImportSourceInput, uploaderId: string): IngestResult {
    // 1. Validate content and parse format
    const processed = validateAndProcessSourceContent(input.source_type, input.raw_content);
    const hash = computeContentHash(processed.rawContent);

    // 2. Hash Deduplication: Check if identical content exists in this project
    const existing = Array.from(this.sources.values()).find(
      s => s.project_id === input.project_id && s.content_hash === hash
    );
    if (existing) {
      return { source: existing, isDuplicate: true };
    }

    const sourceId = `src-${uuidv4().slice(0, 8)}`;
    const clearance = input.clearance_level || 'internal';

    // 3. Split into verifiable chunks with exact offsets
    const chunks = splitIntoVerifiableChunks(sourceId, input.title, processed.rawContent, clearance);

    const doc: SourceDocument = {
      id: sourceId,
      project_id: input.project_id,
      title: input.title.trim(),
      source_type: input.source_type,
      clearance_level: clearance,
      author: input.author.trim(),
      date: input.date || new Date().toISOString(),
      imported_at: new Date().toISOString(),
      raw_content: processed.rawContent,
      content_hash: hash,
      visibility: input.visibility || 'all_members',
      allowed_member_ids: input.visibility === 'restricted_members' ? (input.allowed_member_ids || []) : [],
      uploader_id: uploaderId,
      passages: chunks,
      metadata: processed.metadata,
    };

    this.sources.set(doc.id, doc);
    for (const chunk of chunks) {
      this.passages.set(chunk.id, chunk);
    }

    return { source: doc, isDuplicate: false };
  }

  // --- Permissions Check for Sources (Visibility & Clearance) ---
  public canUserAccessSource(source: SourceDocument, user: User): boolean {
    // Clearance level check (Rule 1)
    if (!canAccessClearance(user.clearance_level, source.clearance_level)) {
      return false;
    }
    // Visibility setting check
    if (source.visibility === 'all_members') {
      return true;
    }
    if (source.visibility === 'restricted_members') {
      if (source.uploader_id === user.id) return true;
      return source.allowed_member_ids.includes(user.id);
    }
    return false;
  }

  // --- Full-Text Search Over Chunks Filtered by Permissions ---
  public searchProjectChunks(projectId: string, query: string, userId: string): SearchResult[] {
    const user = this.getUser(userId);
    if (!user) return [];

    const normalizedQuery = query.toLowerCase().trim();
    if (normalizedQuery.length === 0) return [];

    const queryTokens = normalizedQuery.split(/\s+/).filter(t => t.length > 0);

    // Filter project sources user can access
    const accessibleSources = Array.from(this.sources.values())
      .filter(s => s.project_id === projectId)
      .filter(s => this.canUserAccessSource(s, user));

    const accessibleSourceMap = new Map(accessibleSources.map(s => [s.id, s]));
    const results: SearchResult[] = [];

    for (const passage of this.passages.values()) {
      const source = accessibleSourceMap.get(passage.source_id);
      if (!source) continue;

      const passageLower = passage.text_content.toLowerCase();
      // Match if all query tokens appear in passage text
      const matches = queryTokens.every(token => passageLower.includes(token));

      if (matches) {
        // Build contextual snippet
        const firstMatchPos = passageLower.indexOf(queryTokens[0]);
        const snippetStart = Math.max(0, firstMatchPos - 40);
        const snippetEnd = Math.min(passage.text_content.length, firstMatchPos + 120);
        const prefix = snippetStart > 0 ? '...' : '';
        const suffix = snippetEnd < passage.text_content.length ? '...' : '';
        const snippet = `${prefix}${passage.text_content.slice(snippetStart, snippetEnd)}${suffix}`;

        results.push({
          passage_id: passage.id,
          source_id: source.id,
          source_title: source.title,
          author: source.author,
          date: source.date || source.imported_at,
          char_start: passage.char_start,
          char_end: passage.char_end,
          text_content: passage.text_content,
          snippet,
          clearance_level: passage.clearance_level,
          visibility: source.visibility,
        });
      }
    }

    return results;
  }

  // Legacy helper
  public addSource(source: Omit<SourceDocument, 'passages' | 'content_hash'>): SourceDocument {
    const hash = computeContentHash(source.raw_content);
    const chunks = splitIntoVerifiableChunks(source.id, source.title, source.raw_content, source.clearance_level);
    const doc: SourceDocument = {
      ...source,
      content_hash: hash,
      passages: chunks,
    };
    this.sources.set(doc.id, doc);
    for (const p of chunks) {
      this.passages.set(p.id, p);
    }
    return doc;
  }

  public getSourcesForRecipient(projectId: string, recipientClearance: ClearanceLevel): SourceDocument[] {
    return Array.from(this.sources.values())
      .filter(s => s.project_id === projectId)
      .filter(s => canAccessClearance(recipientClearance, s.clearance_level))
      .map(s => ({
        ...s,
        passages: s.passages.filter(p => canAccessClearance(recipientClearance, p.clearance_level)),
      }));
  }

  public getPassagesForRecipient(projectId: string, recipientClearance: ClearanceLevel): Passage[] {
    const authorizedSources = this.getSourcesForRecipient(projectId, recipientClearance);
    const authorizedSourceIds = new Set(authorizedSources.map(s => s.id));

    return Array.from(this.passages.values())
      .filter(p => authorizedSourceIds.has(p.source_id))
      .filter(p => canAccessClearance(recipientClearance, p.clearance_level));
  }

  public getAllSources(projectId?: string): SourceDocument[] {
    const list = Array.from(this.sources.values());
    if (projectId) {
      return list.filter(s => s.project_id === projectId);
    }
    return list;
  }

  public getSource(id: string): SourceDocument | undefined {
    return this.sources.get(id);
  }

  public getPassage(id: string): Passage | undefined {
    return this.passages.get(id);
  }

  // --- Handover Plans ---
  public getHandovers(projectId?: string): HandoverPlan[] {
    const list = Array.from(this.handovers.values());
    if (projectId) {
      return list.filter(h => h.project_id === projectId);
    }
    return list;
  }

  public getHandover(id: string): HandoverPlan | undefined {
    return this.handovers.get(id);
  }

  public getApprovedVersion(handoverId: string): HandoverPlan | undefined {
    return this.approvedVersions.get(handoverId);
  }

  public saveHandover(plan: HandoverPlan): HandoverPlan {
    if (!plan.version_number) plan.version_number = 1;
    if (plan.is_stale === undefined) plan.is_stale = false;
    this.handovers.set(plan.id, plan);
    if (plan.status === 'approved' || plan.status === 'shared') {
      this.approvedVersions.set(plan.id, JSON.parse(JSON.stringify(plan)));
    }
    return plan;
  }

  public acknowledgeHandover(
    handoverId: string,
    recipientId: string,
    notes?: string
  ): HandoverPlan {
    const plan = this.handovers.get(handoverId);
    if (!plan) {
      throw new Error('Handover plan not found');
    }

    if (plan.recipient_user_id !== recipientId) {
      throw new Error('Access denied: Only the designated recipient can confirm receipt of this handover.');
    }

    const recipient = this.getUser(recipientId);
    const recipientName = recipient ? recipient.name : recipientId;

    plan.acknowledged_at = new Date().toISOString();
    plan.acknowledged_by = recipientName;
    plan.acknowledged_notes = notes;

    plan.audit_logs.push({
      id: uuidv4(),
      action: 'RECIPIENT_ACKNOWLEDGED',
      performed_by: recipientName,
      timestamp: new Date().toISOString(),
      details: notes
        ? `Recipient confirmed reading handover. Notes: ${notes}`
        : 'Recipient formally confirmed reading and acknowledging the handover.',
    });

    plan.updated_at = new Date().toISOString();
    this.handovers.set(handoverId, plan);

    // Keep approved version in sync with acknowledgement
    const approvedVer = this.approvedVersions.get(handoverId);
    if (approvedVer) {
      approvedVer.acknowledged_at = plan.acknowledged_at;
      approvedVer.acknowledged_by = plan.acknowledged_by;
      approvedVer.acknowledged_notes = plan.acknowledged_notes;
      approvedVer.audit_logs.push(plan.audit_logs[plan.audit_logs.length - 1]);
      this.approvedVersions.set(handoverId, approvedVer);
    }

    return plan;
  }

  public updateHandoverItem(
    handoverId: string,
    itemId: string,
    patch: Partial<HandoverItem>,
    reviewerId: string,
    note?: string
  ): HandoverPlan | undefined {
    const plan = this.handovers.get(handoverId);
    if (!plan) return undefined;

    const itemIndex = plan.items.findIndex(it => it.id === itemId);
    if (itemIndex === -1) return undefined;

    const existing = plan.items[itemIndex];
    const reviewer = this.getUser(reviewerId);
    const reviewerName = reviewer ? reviewer.name : reviewerId;

    // Reviewer context: records reviewer citation without mutating original source passage
    const reviewerContext = (patch.statement && patch.statement !== existing.statement) || patch.reviewer_status === 'edited'
      ? {
          reviewer_id: reviewerId,
          reviewer_name: reviewerName,
          edited_at: new Date().toISOString(),
          original_statement: existing.statement,
          reviewer_rationale: note || existing.reviewer_notes,
        }
      : existing.reviewer_context;

    plan.items[itemIndex] = {
      ...existing,
      ...patch,
      reviewer_notes: note ?? patch.reviewer_notes ?? existing.reviewer_notes,
      reviewer_status: patch.reviewer_status || (patch.statement ? 'edited' : existing.reviewer_status),
      reviewer_context: reviewerContext,
    };

    // Phase 6 Invariant: Approved versions are immutable.
    // Editing creates a new draft version (v+1) that must be re-approved by a human reviewer.
    const wasApproved = plan.status === 'approved' || plan.status === 'shared';
    if (wasApproved) {
      plan.status = 'under_review';
      plan.version_number = (plan.version_number || 1) + 1;
      plan.parent_approved_version_id = plan.id;
      plan.approved_at = undefined;
      plan.is_stale = false;
      plan.stale_reason = null;
      plan.audit_logs.push({
        id: uuidv4(),
        action: 'VERSION_INCREMENTED_ON_EDIT',
        performed_by: reviewerName,
        timestamp: new Date().toISOString(),
        details: `Editing approved item transitioned handover to v${plan.version_number} draft requiring re-approval.`,
      });
    }

    const auditAction = patch.reviewer_status === 'rejected'
      ? 'ITEM_REJECTED'
      : patch.reviewer_status === 'approved'
      ? 'ITEM_APPROVED'
      : 'ITEM_UPDATE';

    const auditEntry: AuditLogEntry = {
      id: uuidv4(),
      action: auditAction,
      performed_by: reviewerName,
      timestamp: new Date().toISOString(),
      details: `Updated item "${existing.topic}": ${note || patch.reviewer_status || 'Modified fields'}`,
    };

    plan.audit_logs.push(auditEntry);
    plan.updated_at = new Date().toISOString();
    this.handovers.set(handoverId, plan);
    return plan;
  }

  public recordReviewAction(
    handoverId: string,
    action: 'approve' | 'request_changes' | 'share',
    reviewerId: string,
    comments?: string
  ): HandoverPlan | undefined {
    const plan = this.handovers.get(handoverId);
    if (!plan) return undefined;

    const reviewer = this.getUser(reviewerId);
    const reviewerName = reviewer ? reviewer.name : reviewerId;

    if (action === 'approve') {
      // Phase 4 Requirement: Approve the whole draft only when every factual item is approved or explicitly marked unknown.
      const unapprovedFactualItems = plan.items.filter(it => {
        const isFactual = !it.is_suggestion && it.section !== 'suggested_next_actions';
        if (!isFactual) return false; // Suggestions are not factual constraints
        // If explicitly marked unknown, it is valid without separate sign-off
        if (it.verification_status === 'unknown') return false;
        // Rejected items are excluded from the approved draft, so they do not block approval
        if (it.reviewer_status === 'rejected') return false;
        // Factual items must be approved, accepted, or edited
        return it.reviewer_status !== 'approved' && it.reviewer_status !== 'accepted' && it.reviewer_status !== 'edited';
      });

      if (unapprovedFactualItems.length > 0) {
        throw new Error(
          `Cannot approve draft: ${unapprovedFactualItems.length} factual item(s) are pending review. Every factual item must be approved or explicitly marked unknown before approving the draft.`
        );
      }

      // Phase 4 Requirement: A rejected item does not appear in the approved draft.
      plan.items = plan.items.filter(it => it.reviewer_status !== 'rejected');
      plan.status = 'approved';
      plan.approved_at = new Date().toISOString();
      plan.is_stale = false;
      plan.stale_reason = null;
      // Phase 5 Requirement: Approving a draft creates an immutable approved version tied to one recipient.
      this.approvedVersions.set(plan.id, JSON.parse(JSON.stringify(plan)));
    } else if (action === 'request_changes') {
      plan.status = 'changes_requested';
    } else if (action === 'share') {
      plan.status = 'shared';
      this.approvedVersions.set(plan.id, JSON.parse(JSON.stringify(plan)));
    }

    plan.reviewer_notes = comments;
    plan.audit_logs.push({
      id: uuidv4(),
      action: `REVIEW_${action.toUpperCase()}`,
      performed_by: reviewerName,
      timestamp: new Date().toISOString(),
      details: comments ? `Action ${action}: ${comments}` : `Action: ${action}`,
    });
    plan.updated_at = new Date().toISOString();
    this.handovers.set(handoverId, plan);
    return plan;
  }

  // --- Phase 6: Permission-Driven Invalidation & Staleness ---
  public checkHandoverStaleness(
    handoverId: string,
    recipientId: string
  ): { isStale: boolean; reason?: string } {
    const plan = this.handovers.get(handoverId);
    if (!plan) return { isStale: false };

    // 1. Membership check: If recipient removed, completely blocked
    if (!this.isMemberOfProject(recipientId, plan.project_id)) {
      return {
        isStale: true,
        reason: 'Recipient is no longer a member of this project. Handover is blocked.',
      };
    }

    const recipient = this.getUser(recipientId);
    if (!recipient) {
      return { isStale: true, reason: 'Recipient user account not found.' };
    }

    // 2. Clearance check: If recipient clearance demoted, mark stale if approved content exceeds it
    const approvedVer = this.approvedVersions.get(handoverId) || plan;
    for (const item of approvedVer.items) {
      for (const q of item.quotations) {
        const passage = this.getPassage(q.passage_id);
        const source = passage ? this.getSource(passage.source_id) : undefined;
        if (source) {
          if (!canAccessClearance(recipient.clearance_level, source.clearance_level)) {
            plan.is_stale = true;
            plan.stale_reason = `Recipient clearance level (${recipient.clearance_level.toUpperCase()}) is insufficient for source "${source.title}" (${source.clearance_level.toUpperCase()}). Handover content is stale and must be regenerated.`;
            this.handovers.set(handoverId, plan);
            const approved = this.approvedVersions.get(handoverId);
            if (approved) {
              approved.is_stale = true;
              approved.stale_reason = plan.stale_reason;
              this.approvedVersions.set(handoverId, approved);
            }
            return { isStale: true, reason: plan.stale_reason };
          }
        }
      }
    }

    return { isStale: false };
  }

  // --- Phase 6: Clarifications for Gaps ---
  public generateClarificationQuestions(planId: string): ClarificationQuestion[] {
    const plan = this.handovers.get(planId);
    if (!plan) return [];

    const questions: ClarificationQuestion[] = [];

    for (const item of plan.items) {
      const statementLower = item.statement.toLowerCase();

      // 1. Missing rationale
      const hasRationale = statementLower.includes('because') || statementLower.includes('rationale') || statementLower.includes('due to') || statementLower.includes('standard');
      if (item.item_type === 'decision' && !hasRationale) {
        questions.push({
          id: `clarify-${uuidv4().slice(0, 8)}`,
          gap_item_id: item.id,
          gap_type: 'missing_rationale',
          topic: item.topic,
          question: `What was the technical and architectural rationale for "${item.topic}"?`,
          suggested_action: 'Record architectural decision record (ADR) reference or security rationale.',
        });
      }

      // 2. Unowned tasks
      if (item.item_type === 'task' && (!item.owner || item.owner === 'unknown' || item.verification_status === 'unknown')) {
        questions.push({
          id: `clarify-${uuidv4().slice(0, 8)}`,
          gap_item_id: item.id,
          gap_type: 'unowned_task',
          topic: item.topic,
          question: `Who is officially assigned to take ownership of task "${item.topic}"?`,
          suggested_action: 'Assign an explicit owner established by a ticket or project runbook.',
        });
      }

      // 3. Conflicting dates / timeline
      if (item.verification_status === 'conflicting' || item.topic.toLowerCase().includes('delayed') || item.topic.toLowerCase().includes('schedule') || statementLower.includes('delayed to')) {
        questions.push({
          id: `clarify-${uuidv4().slice(0, 8)}`,
          gap_item_id: item.id,
          gap_type: 'conflicting_dates',
          topic: item.topic,
          question: `What is the reconciled target launch date given conflicting timeline statements across documents?`,
          suggested_action: 'Obtain engineering lead confirmation to establish the single authoritative rollout milestone.',
        });
      }
    }

    return questions;
  }

  // --- Phase 6: Grounded Recipient Q&A (Rule 1 & Rule 2 Compliant) ---
  public askGroundedQuestion(
    handoverId: string,
    question: string,
    callerId: string
  ): QuestionAnswerResponse {
    const plan = this.handovers.get(handoverId);
    if (!plan) {
      throw new Error('Handover plan not found');
    }

    const caller = this.getUser(callerId);
    if (!caller) {
      throw new Error('Unauthorized');
    }

    // Rule 1: Retrieve only permitted chunks for this caller's clearance and project
    if (!this.isMemberOfProject(caller.id, plan.project_id)) {
      throw new Error('Access denied: You are not a member of this project.');
    }

    const permittedChunks = this.getPassagesForRecipient(plan.project_id, caller.clearance_level);
    const qLower = question.toLowerCase().trim();

    const stopWords = new Set([
      'a', 'an', 'the', 'and', 'or', 'for', 'nor', 'but', 'so', 'yet',
      'in', 'on', 'at', 'to', 'from', 'by', 'with', 'about', 'into', 'through', 'after', 'before',
      'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
      'can', 'could', 'shall', 'should', 'will', 'would', 'may', 'might', 'must',
      'what', 'when', 'where', 'which', 'who', 'whom', 'whose', 'why', 'how',
      'this', 'that', 'these', 'those', 'there', 'their', 'they', 'your', 'tell', 'show', 'please'
    ]);
    const tokens = qLower.split(/[\s,?.!]+/).filter(w => w.length > 2 && !stopWords.has(w));

    if (tokens.length === 0 || permittedChunks.length === 0) {
      return {
        question,
        answer: 'insufficient evidence: No permitted documentation or project evidence supports an answer to this question.',
        insufficient_evidence: true,
        verification_status: 'unknown',
        evidence: [],
        is_fallback: false,
      };
    }

    // Score permitted chunks by token match
    let bestChunk: Passage | null = null;
    let bestScore = 0;

    for (const chunk of permittedChunks) {
      const chunkTextLower = chunk.text_content.toLowerCase();
      let matchCount = 0;
      for (const t of tokens) {
        if (chunkTextLower.includes(t)) matchCount++;
      }
      if (matchCount > bestScore) {
        bestScore = matchCount;
        bestChunk = chunk;
      }
    }

    // Threshold check: Must match at least 2 significant tokens (or 1 if the query had only 1)
    const requiredScore = tokens.length > 1 ? 2 : 1;
    if (!bestChunk || bestScore < requiredScore) {
      return {
        question,
        answer: 'insufficient evidence: No permitted documentation or project evidence supports an answer to this question.',
        insufficient_evidence: true,
        verification_status: 'unknown',
        evidence: [],
        is_fallback: false,
      };
    }

    // Extract verbatim matching sentence or line from the original chunk without altering text
    const lines = bestChunk.text_content.split('\n').map(l => l.trim()).filter(Boolean);
    const matchingLine = lines.find(l => {
      const lLower = l.toLowerCase();
      return tokens.filter(t => lLower.includes(t)).length >= Math.min(2, tokens.length);
    }) || lines.find(l => {
      const lLower = l.toLowerCase();
      return tokens.some(t => lLower.includes(t));
    }) || bestChunk.text_content;

    const quoteText = matchingLine;
    const source = this.getSource(bestChunk.source_id);

    // Verbatim quotation verification
    const check = verifyQuotation(quoteText, bestChunk.text_content);
    if (!check.exactMatch) {
      return {
        question,
        answer: 'insufficient evidence: Verification failed to reproduce exact source quotation.',
        insufficient_evidence: true,
        verification_status: 'unknown',
        evidence: [],
        is_fallback: false,
      };
    }

    const evidenceItem: QuotationEvidence = {
      passage_id: bestChunk.id,
      source_title: bestChunk.source_title,
      quote: quoteText,
      exact_match: true,
      char_offset: check.charOffset,
      is_source_accessible: true,
      source_author: source?.author,
      source_date: source?.date,
      source_clearance: source?.clearance_level,
    };

    return {
      question,
      answer: `Verified from source evidence: "${quoteText}"`,
      insufficient_evidence: false,
      verification_status: 'supported',
      evidence: [evidenceItem],
      is_fallback: false,
    };
  }

  // --- Phase 6: Redacted Audit History ---
  public getRedactedAuditLog(handoverId: string, callerId: string): RedactedAuditLogEntry[] {
    const plan = this.handovers.get(handoverId);
    if (!plan) return [];

    const caller = this.getUser(callerId);
    if (!caller || !this.isMemberOfProject(caller.id, plan.project_id)) {
      throw new Error('Access denied.');
    }

    return plan.audit_logs.map(log => {
      let sanitizedDetails = log.details
        .replace(/Passage:\s*".*?"/gi, 'Passage: [REDACTED]')
        .replace(/Quote:\s*".*?"/gi, 'Quote: [REDACTED]')
        .replace(/secret|token|password|unencrypted/gi, '[REDACTED_TERM]');

      return {
        id: log.id,
        action: log.action,
        performed_by: log.performed_by,
        timestamp: log.timestamp,
        details: sanitizedDetails,
        redacted: true,
      };
    });
  }

  public recordViewAudit(handoverId: string, viewerId: string): void {
    const plan = this.handovers.get(handoverId);
    if (!plan) return;
    const viewer = this.getUser(viewerId);
    const viewerName = viewer ? viewer.name : viewerId;
    plan.audit_logs.push({
      id: uuidv4(),
      action: 'HANDOVER_VIEWED',
      performed_by: viewerName,
      timestamp: new Date().toISOString(),
      details: `Handover viewed by ${viewerName}. Sensitive details redacted.`,
    });
    this.handovers.set(handoverId, plan);
  }
}

export const db = new DatabaseStore();
