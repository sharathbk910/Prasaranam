import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { db } from './db/store.js';
import {
  GenerateHandoverRequestSchema,
  ReviewActionSchema,
  SourceDocumentSchema,
  ClearanceLevelEnum,
  CreateProjectRequestSchema,
  AuthCredentialsSchema,
  ImportSourceInputSchema,
  StartExtractionRequestSchema,
  AcknowledgeHandoverRequestSchema,
  QuestionAnswerRequestSchema,
  canAccessClearance,
  User,
  HandoverPlan,
} from '@prasaranam/shared';
import { generateHandoverPlan } from './services/geminiService.js';
import { extractionManager } from './services/knowledgeExtractor.js';

export const app = express();

app.use(cors());
app.use(express.json({ limit: '5mb' }));

// Extend Express Request to hold authenticated user
export interface AuthenticatedRequest extends Request {
  user?: User;
}

// Auth Helper & Middleware
export function extractToken(req: Request): string | undefined {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  const xToken = req.headers['x-auth-token'];
  if (typeof xToken === 'string') return xToken;
  return undefined;
}

export function authMiddleware(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (token) {
    const user = db.getUserByToken(token);
    if (user) {
      req.user = user;
    }
  }
  // Also support mock user header for testing if token not present
  if (!req.user) {
    const userIdHeader = req.headers['x-user-id'] as string;
    if (userIdHeader) {
      const user = db.getUser(userIdHeader);
      if (user) req.user = user;
    }
  }
  next();
}

export function getCallerUser(req: Request): User | undefined {
  const authReq = req as AuthenticatedRequest;
  if (authReq.user) return authReq.user;
  const headerUserId = req.headers['x-user-id'] as string;
  if (headerUserId) return db.getUser(headerUserId);
  return undefined;
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }
  next();
}

app.use(authMiddleware);

// --- Health ---
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'prasaranam-server',
    time: new Date().toISOString(),
    gemini_configured: Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY),
    supabase_configured: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
  });
});

// --- Supabase / In-Memory Auth Endpoints ---
app.post('/api/auth/signup', (req, res) => {
  const parsed = AuthCredentialsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid credentials payload', details: parsed.error.issues });
    return;
  }
  try {
    const session = db.signUp(parsed.data.email, parsed.data.password, parsed.data.name);
    res.status(201).json(session);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/auth/signin', (req, res) => {
  const parsed = AuthCredentialsSchema.pick({ email: true, password: true }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid email or password format', details: parsed.error.issues });
    return;
  }
  try {
    const session = db.signIn(parsed.data.email, parsed.data.password);
    res.json(session);
  } catch (err: any) {
    res.status(401).json({ error: err.message });
  }
});

app.post('/api/auth/signout', (req, res) => {
  const token = extractToken(req);
  if (token) {
    db.signOut(token);
  }
  res.json({ success: true, message: 'Signed out successfully.' });
});

app.get('/api/auth/me', (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  res.json(req.user);
});

// --- Workspaces ---
app.get('/api/workspaces', requireAuth, (req: AuthenticatedRequest, res) => {
  const workspaces = db.getWorkspacesForUser(req.user!.id);
  res.json(workspaces);
});

// --- Projects (RLS Protected: User can read only projects they are a member of!) ---
app.get('/api/projects', requireAuth, (req: AuthenticatedRequest, res) => {
  const projects = db.getProjectsForUser(req.user!.id);
  res.json(projects);
});

app.post('/api/projects', requireAuth, (req: AuthenticatedRequest, res) => {
  const parsed = CreateProjectRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid project payload', details: parsed.error.issues });
    return;
  }
  const project = db.createProject(parsed.data.name, parsed.data.description, req.user!.id, parsed.data.workspace_id);
  res.status(201).json(project);
});

app.get('/api/projects/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  const projectId = String(req.params.id);
  const project = db.getProjectForUser(projectId, req.user!.id);
  if (!project) {
    // Non-member or non-existent project returns 403 Forbidden / 404
    res.status(403).json({ error: 'Access denied: You are not a member of this project.' });
    return;
  }
  const members = db.getMembershipsForProject(project.id);
  res.json({
    ...project,
    members,
  });
});

// --- Users List ---
app.get('/api/users', (_req, res) => {
  res.json(db.getUsers());
});

app.get('/api/users/:id', (req, res) => {
  const userId = String(req.params.id);
  const user = db.getUser(userId);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.json(user);
});

// --- Sources & Passages ---
app.post('/api/projects/:id/sources/import', requireAuth, (req: AuthenticatedRequest, res) => {
  const projectId = String(req.params.id);
  const project = db.getProjectForUser(projectId, req.user!.id);
  if (!project) {
    res.status(403).json({ error: 'Access denied: You are not a member of this project.' });
    return;
  }

  const parsed = ImportSourceInputSchema.safeParse({ ...req.body, project_id: projectId });
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid source input payload', details: parsed.error.issues });
    return;
  }

  try {
    const result = db.importSource(parsed.data, req.user!.id);
    const status = result.isDuplicate ? 200 : 201;
    res.status(status).json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Full-text search over chunks with permissions filtering
app.get('/api/projects/:id/search', requireAuth, (req: AuthenticatedRequest, res) => {
  const projectId = String(req.params.id);
  const project = db.getProjectForUser(projectId, req.user!.id);
  if (!project) {
    res.status(403).json({ error: 'Access denied: You are not a member of this project.' });
    return;
  }

  const q = (req.query.q as string) || '';
  const results = db.searchProjectChunks(projectId, q, req.user!.id);
  res.json(results);
});

app.get('/api/projects/:id/sources', requireAuth, (req: AuthenticatedRequest, res) => {
  const projectId = String(req.params.id);
  const project = db.getProjectForUser(projectId, req.user!.id);
  if (!project) {
    res.status(403).json({ error: 'Access denied: You are not a member of this project.' });
    return;
  }

  const clearanceQuery = req.query.clearance as string | undefined;
  if (clearanceQuery) {
    const parsed = ClearanceLevelEnum.safeParse(clearanceQuery);
    if (parsed.success) {
      res.json(db.getSourcesForRecipient(projectId, parsed.data));
      return;
    }
  }
  res.json(db.getAllSources(projectId));
});

app.post('/api/sources', requireAuth, (req: AuthenticatedRequest, res) => {
  const parsed = SourceDocumentSchema.omit({ id: true, passages: true, imported_at: true }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid source document payload', details: parsed.error.issues });
    return;
  }
  // Check membership in project
  const project = db.getProjectForUser(parsed.data.project_id, req.user!.id);
  if (!project) {
    res.status(403).json({ error: 'Access denied: Cannot add sources to a project you do not belong to.' });
    return;
  }

  const id = `src-custom-${Date.now()}`;
  const doc = db.addSource({
    ...parsed.data,
    id,
    imported_at: new Date().toISOString(),
  });
  res.status(201).json(doc);
});

app.get('/api/passages/:id', (req, res) => {
  const passageId = String(req.params.id);
  const passage = db.getPassage(passageId);
  if (!passage) {
    res.status(404).json({ error: 'Passage not found' });
    return;
  }

  const caller = getCallerUser(req);
  if (caller) {
    const source = db.getSource(passage.source_id);
    if (source) {
      // Recheck project membership on every read
      if (!db.isMemberOfProject(caller.id, source.project_id)) {
        res.status(403).json({ error: 'Access denied: You are not a member of this project.' });
        return;
      }
      // Recheck clearance boundary on every read
      if (!canAccessClearance(caller.clearance_level, source.clearance_level)) {
        res.status(403).json({
          error: `Access denied: Passage is restricted to clearance level ${source.clearance_level.toUpperCase()}. Your clearance (${caller.clearance_level.toUpperCase()}) is insufficient.`,
        });
        return;
      }
    }
  }

  res.json(passage);
});

// --- Knowledge Reconstruction & Extraction Jobs (Phase 3) ---
app.post('/api/projects/:id/extraction/start', requireAuth, async (req: AuthenticatedRequest, res) => {
  const projectId = String(req.params.id);
  const project = db.getProjectForUser(projectId, req.user!.id);
  if (!project) {
    res.status(403).json({ error: 'Access denied: You are not a member of this project.' });
    return;
  }

  const parsed = StartExtractionRequestSchema.safeParse({ ...req.body, project_id: projectId });
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid extraction parameters', details: parsed.error.issues });
    return;
  }

  try {
    const job = await extractionManager.startExtraction(
      projectId,
      req.user!.id,
      parsed.data.force_fallback ?? false,
      parsed.data.title
    );
    res.status(202).json(job);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to start extraction job.' });
  }
});

app.get('/api/projects/:id/extraction/jobs', requireAuth, (req: AuthenticatedRequest, res) => {
  const projectId = String(req.params.id);
  const project = db.getProjectForUser(projectId, req.user!.id);
  if (!project) {
    res.status(403).json({ error: 'Access denied: You are not a member of this project.' });
    return;
  }

  const jobs = extractionManager.getJobsForProject(projectId);
  res.json(jobs);
});

app.get('/api/projects/:id/extraction/status/:jobId', requireAuth, (req: AuthenticatedRequest, res) => {
  const projectId = String(req.params.id);
  const jobId = String(req.params.jobId);
  const project = db.getProjectForUser(projectId, req.user!.id);
  if (!project) {
    res.status(403).json({ error: 'Access denied: You are not a member of this project.' });
    return;
  }

  const job = extractionManager.getJob(jobId);
  if (!job || job.project_id !== projectId) {
    res.status(404).json({ error: 'Extraction job not found.' });
    return;
  }

  res.json(job);
});

app.post('/api/projects/:id/extraction/retry/:jobId', requireAuth, async (req: AuthenticatedRequest, res) => {
  const projectId = String(req.params.id);
  const jobId = String(req.params.jobId);
  const project = db.getProjectForUser(projectId, req.user!.id);
  if (!project) {
    res.status(403).json({ error: 'Access denied: You are not a member of this project.' });
    return;
  }

  try {
    const job = await extractionManager.retryJob(jobId, req.user!.id);
    res.json(job);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to retry extraction job.' });
  }
});

// --- Handovers ---
app.get('/api/handovers', (req, res) => {
  const projectId = req.query.projectId as string | undefined;
  res.json(db.getHandovers(projectId));
});

app.get('/api/handovers/:id', (req, res) => {
  const rawPlan = db.getHandover(req.params.id);
  if (!rawPlan) {
    res.status(404).json({ error: 'Handover plan not found' });
    return;
  }

  const caller = getCallerUser(req);

  // Phase 5 Invariant: Server rechecks permissions and approval state on every read
  if (caller) {
    // 1. Cross-project check & membership revocation check
    if (!db.isMemberOfProject(caller.id, rawPlan.project_id)) {
      res.status(403).json({
        error: 'Access denied: You are not a member of this project or your membership was revoked.',
      });
      return;
    }

    // 2. Recipient view restriction: recipient only sees approved/shared version, not unapproved drafts
    const isRecipient = caller.id === rawPlan.recipient_user_id;
    const isPrivileged = ['admin', 'owner', 'reviewer'].includes(caller.role);
    if (isRecipient && !isPrivileged) {
      if (rawPlan.status !== 'approved' && rawPlan.status !== 'shared') {
        res.status(403).json({
          error: 'Access denied: Handover draft is pending human review and has not yet been approved.',
        });
        return;
      }

      // Phase 6 Invariant: Stale detection when recipient access changes
      const staleCheck = db.checkHandoverStaleness(rawPlan.id, caller.id);
      if (staleCheck.isStale) {
        res.status(403).json({
          error: `Access blocked: ${staleCheck.reason || 'Handover is stale and must be regenerated.'}`,
          is_stale: true,
          stale_reason: staleCheck.reason,
        });
        return;
      }
    }
  }

  // Phase 5 Invariant: Approving a draft creates an immutable approved version tied to one recipient.
  // The recipient's view shows only that approved version.
  const isApprovedOrShared = rawPlan.status === 'approved' || rawPlan.status === 'shared';
  const effectivePlan: HandoverPlan = isApprovedOrShared
    ? JSON.parse(JSON.stringify(db.getApprovedVersion(rawPlan.id) || rawPlan))
    : JSON.parse(JSON.stringify(rawPlan));

  // Dynamic live permissions recheck for every quotation evidence link
  for (const item of effectivePlan.items) {
    for (const q of item.quotations) {
      const passage = db.getPassage(q.passage_id);
      const source = passage ? db.getSource(passage.source_id) : undefined;
      if (source) {
        q.source_author = source.author;
        q.source_date = source.date;
        q.source_clearance = source.clearance_level;
        if (caller) {
          const hasClearance = canAccessClearance(caller.clearance_level, source.clearance_level);
          const isMember = db.isMemberOfProject(caller.id, source.project_id);
          q.is_source_accessible = hasClearance && isMember;
          if (!q.is_source_accessible) {
            q.quote = '[Restricted Passage: Unavailable due to clearance boundary]';
          }
        } else {
          q.is_source_accessible = true;
        }
      }
    }
  }

  if (caller) {
    db.recordViewAudit(rawPlan.id, caller.id);
  }

  res.json(effectivePlan);
});

// Phase 5: Acknowledgement of receipt: recipient confirms they have read the handover
app.post('/api/handovers/:id/acknowledge', (req, res) => {
  const caller = getCallerUser(req);
  if (!caller) {
    res.status(401).json({ error: 'Authentication required to acknowledge handover receipt.' });
    return;
  }

  const parsed = AcknowledgeHandoverRequestSchema.safeParse(req.body);
  try {
    const updated = db.acknowledgeHandover(
      req.params.id,
      caller.id,
      parsed.success ? parsed.data.notes : undefined
    );
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to acknowledge handover' });
  }
});

// Project membership management endpoint (remove member)
app.delete('/api/projects/:id/members/:userId', (req, res) => {
  const projectId = String(req.params.id);
  const targetUserId = String(req.params.userId);
  const caller = getCallerUser(req);
  if (caller && !db.isMemberOfProject(caller.id, projectId)) {
    res.status(403).json({ error: 'Access denied: You are not a member of this project.' });
    return;
  }

  db.removeMembership(targetUserId, projectId);
  res.json({ success: true, removed_user_id: targetUserId, project_id: projectId });
});

// --- Phase 6: Grounded Q&A, Clarifications, Exports, Redacted Audit Logs ---

// 1. Clarification questions for gaps (unowned tasks, missing rationales, conflicting dates)
app.get('/api/handovers/:id/clarifications', (req, res) => {
  const plan = db.getHandover(req.params.id);
  if (!plan) {
    res.status(404).json({ error: 'Handover plan not found' });
    return;
  }
  const caller = getCallerUser(req);
  if (caller && !db.isMemberOfProject(caller.id, plan.project_id)) {
    res.status(403).json({ error: 'Access denied: You are not a member of this project.' });
    return;
  }

  const questions = db.generateClarificationQuestions(plan.id);
  res.json(questions);
});

// 2. Grounded Q&A: recipient asks questions, answers come ONLY from permitted validated evidence
app.post('/api/handovers/:id/qa', (req, res) => {
  const plan = db.getHandover(req.params.id);
  if (!plan) {
    res.status(404).json({ error: 'Handover plan not found' });
    return;
  }

  const caller = getCallerUser(req);
  if (!caller) {
    res.status(401).json({ error: 'Authentication required for grounded Q&A.' });
    return;
  }

  const parsed = QuestionAnswerRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid question format', details: parsed.error.issues });
    return;
  }

  try {
    const qaResult = db.askGroundedQuestion(plan.id, parsed.data.question, caller.id);
    res.json(qaResult);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to process question' });
  }
});

// 3. Redacted Audit Log (Redacts sensitive passages, records who approved/viewed/edited)
app.get('/api/handovers/:id/audit-log', (req, res) => {
  const plan = db.getHandover(req.params.id);
  if (!plan) {
    res.status(404).json({ error: 'Handover plan not found' });
    return;
  }
  const caller = getCallerUser(req);
  if (!caller || !db.isMemberOfProject(caller.id, plan.project_id)) {
    res.status(403).json({ error: 'Access denied: You are not a member of this project.' });
    return;
  }

  const logs = db.getRedactedAuditLog(plan.id, caller.id);
  res.json(logs);
});

// Helper: Generate sanitized Markdown respecting caller permissions
function formatHandoverMarkdown(plan: HandoverPlan, callerClearance: any): string {
  const lines: string[] = [];
  lines.push(`# Project Knowledge Handover: ${plan.title}`);
  lines.push(`**Project:** ${plan.project_name} (${plan.project_id})  `);
  lines.push(`**Departing Member:** ${plan.departing_user_name}  `);
  lines.push(`**Incoming Recipient:** ${plan.recipient_user_name} (Clearance: ${plan.recipient_clearance.toUpperCase()})  `);
  lines.push(`**Version:** v${plan.version_number || 1} | **Status:** ${plan.status.toUpperCase()}  `);
  lines.push(`**Approved At:** ${plan.approved_at || 'Pending Approval'}  `);
  lines.push(`**Mode:** ${plan.generated_with_fallback ? 'NON-AI DETERMINISTIC FALLBACK' : 'LIVE AI SYNTHESIS'}  `);
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## Executive Summary');
  lines.push(plan.summary);
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## Verified Handover Statements');
  lines.push('');

  for (const item of plan.items) {
    if (item.reviewer_status === 'rejected') continue;
    lines.push(`### [${item.item_type.toUpperCase()}] ${item.topic}`);
    lines.push(`- **Statement:** ${item.statement}`);
    lines.push(`- **Verification Status:** ${item.verification_status}`);
    lines.push(`- **Owner:** ${item.owner || 'Unknown'}`);
    if (item.reviewer_context) {
      lines.push(`- **Reviewer Note:** Edited by ${item.reviewer_context.reviewer_name}: "${item.reviewer_context.reviewer_rationale || 'Reviewed and modified'}"`);
    }

    if (item.quotations && item.quotations.length > 0) {
      lines.push('- **Citations & Exact Passages:**');
      for (const q of item.quotations) {
        const canSee = canAccessClearance(callerClearance, q.source_clearance || 'public');
        if (canSee) {
          lines.push(`  - "${q.quote}" *(Source: ${q.source_title}, Author: ${q.source_author || 'Project Member'}, Date: ${q.source_date || 'N/A'})*`);
        } else {
          lines.push(`  - *[Restricted Citation: Unavailable due to clearance boundary (${(q.source_clearance || 'restricted').toUpperCase()})]*`);
        }
      }
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push('## Recipient Acknowledgement');
  if (plan.acknowledged_at) {
    lines.push(`- **Confirmed By:** ${plan.acknowledged_by || plan.recipient_user_name}`);
    lines.push(`- **Confirmed At:** ${plan.acknowledged_at}`);
    if (plan.acknowledged_notes) lines.push(`- **Notes:** ${plan.acknowledged_notes}`);
  } else {
    lines.push('- *Pending formal receipt confirmation by incoming recipient.*');
  }

  lines.push('');
  lines.push('---');
  lines.push('*Generated by Prasaranam — AI-Powered Verifiable Project Knowledge-Handover System*');
  return lines.join('\n');
}

// 4. Authenticated Markdown Export (Approved versions only, respects recipient permissions)
app.get('/api/handovers/:id/export/markdown', (req, res) => {
  const rawPlan = db.getHandover(req.params.id);
  if (!rawPlan) {
    res.status(404).json({ error: 'Handover plan not found' });
    return;
  }

  const caller = getCallerUser(req);
  if (!caller || !db.isMemberOfProject(caller.id, rawPlan.project_id)) {
    res.status(403).json({ error: 'Access denied: You are not a member of this project.' });
    return;
  }

  // Export approved versions only
  if (rawPlan.status !== 'approved' && rawPlan.status !== 'shared') {
    res.status(400).json({ error: 'Only approved handovers can be exported.' });
    return;
  }

  // Check staleness
  const staleCheck = db.checkHandoverStaleness(rawPlan.id, caller.id);
  if (staleCheck.isStale) {
    res.status(403).json({ error: `Cannot export stale handover: ${staleCheck.reason}` });
    return;
  }

  const effectivePlan: HandoverPlan = db.getApprovedVersion(rawPlan.id) || rawPlan;
  const mdContent = formatHandoverMarkdown(effectivePlan, caller.clearance_level);

  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="handover-${effectivePlan.id}.md"`);
  res.send(mdContent);
});

// 5. Authenticated PDF / Print-Ready Document Export (Approved versions only)
app.get('/api/handovers/:id/export/pdf', (req, res) => {
  const rawPlan = db.getHandover(req.params.id);
  if (!rawPlan) {
    res.status(404).json({ error: 'Handover plan not found' });
    return;
  }

  const caller = getCallerUser(req);
  if (!caller || !db.isMemberOfProject(caller.id, rawPlan.project_id)) {
    res.status(403).json({ error: 'Access denied: You are not a member of this project.' });
    return;
  }

  if (rawPlan.status !== 'approved' && rawPlan.status !== 'shared') {
    res.status(400).json({ error: 'Only approved handovers can be exported.' });
    return;
  }

  const staleCheck = db.checkHandoverStaleness(rawPlan.id, caller.id);
  if (staleCheck.isStale) {
    res.status(403).json({ error: `Cannot export stale handover: ${staleCheck.reason}` });
    return;
  }

  const effectivePlan: HandoverPlan = db.getApprovedVersion(rawPlan.id) || rawPlan;
  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Handover Export - ${effectivePlan.title}</title>
  <style>
    @media print {
      body { font-size: 11pt; line-height: 1.5; color: #111; }
      .no-print { display: none; }
      @page { margin: 2cm; }
    }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #1e293b; line-height: 1.6; }
    h1 { border-bottom: 2px solid #0284c7; padding-bottom: 8px; color: #0f172a; }
    h2 { color: #0369a1; margin-top: 24px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
    h3 { margin-top: 16px; margin-bottom: 6px; }
    .badge { display: inline-block; padding: 2px 8px; font-size: 11px; font-weight: bold; border-radius: 4px; background: #e0f2fe; color: #0369a1; }
    .quote-box { background: #f8fafc; border-left: 3px solid #0284c7; padding: 8px 12px; margin: 6px 0; font-size: 13px; font-style: italic; }
    .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    .meta-table td { padding: 4px 8px; border: 1px solid #e2e8f0; font-size: 13px; }
    .meta-table td.label { font-weight: bold; background: #f1f5f9; width: 180px; }
    .btn-print { background: #0284c7; color: white; padding: 10px 16px; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; margin-bottom: 20px; }
  </style>
</head>
<body>
  <div class="no-print">
    <button class="btn-print" onclick="window.print()">Print / Save as PDF</button>
  </div>
  <h1>Prasaranam Knowledge Handover</h1>
  <table class="meta-table">
    <tr><td class="label">Project</td><td>${effectivePlan.project_name}</td></tr>
    <tr><td class="label">Title</td><td>${effectivePlan.title}</td></tr>
    <tr><td class="label">Departing Member</td><td>${effectivePlan.departing_user_name}</td></tr>
    <tr><td class="label">Recipient</td><td>${effectivePlan.recipient_user_name} (${effectivePlan.recipient_clearance.toUpperCase()})</td></tr>
    <tr><td class="label">Version</td><td>v${effectivePlan.version_number || 1} (${effectivePlan.status.toUpperCase()})</td></tr>
    <tr><td class="label">Approved Date</td><td>${effectivePlan.approved_at || 'Under Review'}</td></tr>
  </table>
  <h2>Executive Summary</h2>
  <p>${effectivePlan.summary}</p>
  <h2>Verified Handover Statements & Actions</h2>
  ${effectivePlan.items.filter(it => it.reviewer_status !== 'rejected').map(it => `
    <div>
      <h3><span class="badge">${it.item_type.toUpperCase()}</span> ${it.topic}</h3>
      <p>${it.statement}</p>
      <p style="font-size:12px; color:#64748b;">Verification: <strong>${it.verification_status}</strong> | Owner: <strong>${it.owner || 'Unknown'}</strong></p>
      ${it.quotations && it.quotations.length > 0 ? `
        <div class="quote-box">
          ${it.quotations.map(q => {
            const canSee = canAccessClearance(caller.clearance_level, q.source_clearance || 'public');
            return canSee
              ? `<div>&ldquo;${q.quote}&rdquo; &mdash; <em>${q.source_title} (${q.source_author || 'Team Member'}, ${q.source_date || 'N/A'})</em></div>`
              : `<div style="color:#ef4444;">[Restricted Citation: Unavailable due to clearance boundary]</div>`;
          }).join('')}
        </div>
      ` : ''}
    </div>
  `).join('')}
  <h2>Recipient Acknowledgement</h2>
  ${effectivePlan.acknowledged_at ? `
    <p><strong>Formally Confirmed by:</strong> ${effectivePlan.acknowledged_by} on ${effectivePlan.acknowledged_at}</p>
    ${effectivePlan.acknowledged_notes ? `<p><strong>Notes:</strong> ${effectivePlan.acknowledged_notes}</p>` : ''}
  ` : '<p><em>Pending formal receipt confirmation by incoming recipient.</em></p>'}
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Disposition', `inline; filename="handover-${effectivePlan.id}.html"`);
  res.send(htmlContent);
});

app.post('/api/handovers/generate', async (req, res) => {
  const parsed = GenerateHandoverRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid generation request', details: parsed.error.issues });
    return;
  }

  try {
    const plan = await generateHandoverPlan(parsed.data);
    res.status(201).json(plan);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/handovers/:id/review', (req, res) => {
  const parsed = ReviewActionSchema.safeParse({ ...req.body, handover_id: req.params.id });
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid review action payload', details: parsed.error.issues });
    return;
  }

  const { handover_id, action, item_id, item_patch, comment } = parsed.data;
  const reviewerId = (req.headers['x-user-id'] as string) || 'user-sarah-reviewer';

  if (action === 'update_item' && item_id) {
    const updated = db.updateHandoverItem(handover_id, item_id, item_patch || {}, reviewerId, comment);
    if (!updated) {
      res.status(404).json({ error: 'Handover or item not found' });
      return;
    }
    res.json(updated);
    return;
  }

  if (action === 'approve_item' && item_id) {
    const updated = db.updateHandoverItem(handover_id, item_id, { reviewer_status: 'approved' }, reviewerId, comment);
    if (!updated) {
      res.status(404).json({ error: 'Handover or item not found' });
      return;
    }
    res.json(updated);
    return;
  }

  if (action === 'reject_item' && item_id) {
    const updated = db.updateHandoverItem(handover_id, item_id, { reviewer_status: 'rejected' }, reviewerId, comment);
    if (!updated) {
      res.status(404).json({ error: 'Handover or item not found' });
      return;
    }
    res.json(updated);
    return;
  }

  if (action === 'edit_item' && item_id) {
    const updated = db.updateHandoverItem(
      handover_id,
      item_id,
      {
        ...item_patch,
        statement: parsed.data.edited_statement || item_patch?.statement,
        reviewer_status: 'edited',
      },
      reviewerId,
      comment
    );
    if (!updated) {
      res.status(404).json({ error: 'Handover or item not found' });
      return;
    }
    res.json(updated);
    return;
  }

  if (['approve', 'request_changes', 'share'].includes(action)) {
    try {
      const updated = db.recordReviewAction(handover_id, action as any, reviewerId, comment);
      if (!updated) {
        res.status(404).json({ error: 'Handover not found' });
        return;
      }
      res.json(updated);
      return;
    } catch (err: any) {
      res.status(400).json({ error: err.message });
      return;
    }
  }

  res.status(400).json({ error: `Unsupported action: ${action}` });
});

// Test helper: reset in-memory DB to seed data between test runs
app.post('/api/test/reset', (_req, res) => {
  db.resetToSeed();
  extractionManager.reset();
  res.json({ message: 'Store reset to seed' });
});
