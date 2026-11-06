import {
  User,
  Project,
  Workspace,
  SourceDocument,
  Passage,
  HandoverPlan,
  GenerateHandoverRequest,
  ReviewAction,
  CreateProjectRequest,
  AuthCredentials,
  ImportSourceInput,
  SearchResult,
  ExtractionJob,
  ClarificationQuestion,
  QuestionAnswerResponse,
  RedactedAuditLogEntry,
} from '@prasaranam/shared';

const API_BASE = '/api';

export function getAuthToken(): string | null {
  return localStorage.getItem('prasaranam_token');
}

export function setAuthToken(token: string | null): void {
  if (token) {
    localStorage.setItem('prasaranam_token', token);
  } else {
    localStorage.removeItem('prasaranam_token');
  }
}

function getHeaders(customHeaders: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...customHeaders,
  };
  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

// --- Auth APIs ---
export async function apiSignUp(creds: AuthCredentials): Promise<{ user: User; token: string }> {
  const res = await fetch(`${API_BASE}/auth/signup`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(creds),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Sign up failed' }));
    throw new Error(err.error || 'Sign up failed');
  }
  const data = await res.json();
  setAuthToken(data.token);
  return data;
}

export async function apiSignIn(creds: { email: string; password: string }): Promise<{ user: User; token: string }> {
  const res = await fetch(`${API_BASE}/auth/signin`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(creds),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Sign in failed' }));
    throw new Error(err.error || 'Sign in failed');
  }
  const data = await res.json();
  setAuthToken(data.token);
  return data;
}

export async function apiSignOut(): Promise<void> {
  try {
    await fetch(`${API_BASE}/auth/signout`, {
      method: 'POST',
      headers: getHeaders(),
    });
  } finally {
    setAuthToken(null);
  }
}

export async function apiGetMe(): Promise<User | null> {
  const token = getAuthToken();
  if (!token) return null;
  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: getHeaders(),
  });
  if (!res.ok) {
    setAuthToken(null);
    return null;
  }
  return res.json();
}

// --- Health ---
export async function fetchHealth(): Promise<{ status: string; gemini_configured: boolean }> {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) throw new Error('Failed to fetch health');
  return res.json();
}

// --- Workspaces & Projects ---
export async function fetchWorkspaces(): Promise<Workspace[]> {
  const res = await fetch(`${API_BASE}/workspaces`, {
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch workspaces');
  return res.json();
}

export async function fetchProjects(): Promise<Project[]> {
  const res = await fetch(`${API_BASE}/projects`, {
    headers: getHeaders(),
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error('Unauthorized');
    throw new Error('Failed to fetch projects');
  }
  return res.json();
}

export async function fetchProject(id: string): Promise<Project & { members: Array<{ user: User; role: string }> }> {
  const res = await fetch(`${API_BASE}/projects/${id}`, {
    headers: getHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to fetch project' }));
    throw new Error(err.error || 'Failed to fetch project');
  }
  return res.json();
}

export async function createProject(data: CreateProjectRequest): Promise<Project> {
  const res = await fetch(`${API_BASE}/projects`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Project creation failed' }));
    throw new Error(err.error || 'Project creation failed');
  }
  return res.json();
}

// --- Users ---
export async function fetchUsers(): Promise<User[]> {
  const res = await fetch(`${API_BASE}/users`, {
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch users');
  return res.json();
}

// --- Sources & Passages ---
export async function fetchSources(projectId: string, clearance?: string): Promise<SourceDocument[]> {
  const url = clearance
    ? `${API_BASE}/projects/${projectId}/sources?clearance=${clearance}`
    : `${API_BASE}/projects/${projectId}/sources`;
  const res = await fetch(url, {
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch sources');
  return res.json();
}

export async function ingestSource(source: {
  project_id: string;
  title: string;
  source_type: string;
  clearance_level: string;
  author: string;
  raw_content: string;
}): Promise<SourceDocument> {
  const res = await fetch(`${API_BASE}/sources`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(source),
  });
  if (!res.ok) throw new Error('Failed to ingest source');
  return res.json();
}

export async function importProjectSource(
  projectId: string,
  input: Omit<ImportSourceInput, 'project_id'>
): Promise<{ source: SourceDocument; isDuplicate: boolean }> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/sources/import`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Import failed' }));
    throw new Error(err.error || 'Import failed');
  }
  return res.json();
}

export async function searchProjectSources(projectId: string, query: string): Promise<SearchResult[]> {
  if (!query.trim()) return [];
  const res = await fetch(`${API_BASE}/projects/${projectId}/search?q=${encodeURIComponent(query.trim())}`, {
    headers: getHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Search failed' }));
    throw new Error(err.error || 'Search failed');
  }
  return res.json();
}

export async function fetchPassage(passageId: string): Promise<Passage> {
  const res = await fetch(`${API_BASE}/passages/${passageId}`, {
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch passage');
  return res.json();
}

// --- Handovers ---
export async function fetchHandovers(projectId?: string): Promise<HandoverPlan[]> {
  const url = projectId ? `${API_BASE}/handovers?projectId=${projectId}` : `${API_BASE}/handovers`;
  const res = await fetch(url, {
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch handovers');
  return res.json();
}

export async function fetchHandover(id: string): Promise<HandoverPlan> {
  const res = await fetch(`${API_BASE}/handovers/${id}`, {
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch handover plan');
  return res.json();
}

export async function generateHandover(request: GenerateHandoverRequest): Promise<HandoverPlan> {
  const res = await fetch(`${API_BASE}/handovers/generate`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(request),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Generation failed' }));
    throw new Error(err.error || 'Generation failed');
  }
  return res.json();
}

export async function reviewHandover(
  handoverId: string,
  action: ReviewAction,
  reviewerId: string = 'user-sarah-reviewer'
): Promise<HandoverPlan> {
  const res = await fetch(`${API_BASE}/handovers/${handoverId}/review`, {
    method: 'POST',
    headers: getHeaders({ 'x-user-id': reviewerId }),
    body: JSON.stringify(action),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Review action failed' }));
    throw new Error(err.error || 'Review action failed');
  }
  return res.json();
}

export async function acknowledgeHandover(
  handoverId: string,
  input: { notes?: string },
  recipientId?: string
): Promise<HandoverPlan> {
  const headers = getHeaders(recipientId ? { 'x-user-id': recipientId } : {});
  const res = await fetch(`${API_BASE}/handovers/${handoverId}/acknowledge`, {
    method: 'POST',
    headers,
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Acknowledgement failed' }));
    throw new Error(err.error || 'Acknowledgement failed');
  }
  return res.json();
}

// --- Knowledge Reconstruction & Extraction (Phase 3) ---
export async function startExtractionJob(
  projectId: string,
  forceFallback?: boolean,
  title?: string
): Promise<ExtractionJob> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/extraction/start`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ force_fallback: forceFallback, title }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to start extraction job' }));
    throw new Error(err.error || 'Failed to start extraction job');
  }
  return res.json();
}

export async function fetchExtractionJobs(projectId: string): Promise<ExtractionJob[]> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/extraction/jobs`, {
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch extraction jobs');
  return res.json();
}

export async function fetchExtractionJobStatus(projectId: string, jobId: string): Promise<ExtractionJob> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/extraction/status/${jobId}`, {
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch extraction job status');
  return res.json();
}

export async function retryExtractionJob(projectId: string, jobId: string): Promise<ExtractionJob> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/extraction/retry/${jobId}`, {
    method: 'POST',
    headers: getHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to retry extraction job' }));
    throw new Error(err.error || 'Failed to retry extraction job');
  }
  return res.json();
}

// --- Phase 6: Clarifications, Grounded Q&A, Exports, Redacted Audit Logs ---

export async function fetchClarificationQuestions(handoverId: string): Promise<ClarificationQuestion[]> {
  const res = await fetch(`${API_BASE}/handovers/${handoverId}/clarifications`, {
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch clarification questions');
  return res.json();
}

export async function askGroundedQuestion(
  handoverId: string,
  question: string,
  userId?: string
): Promise<QuestionAnswerResponse> {
  const headers = getHeaders(userId ? { 'x-user-id': userId } : {});
  const res = await fetch(`${API_BASE}/handovers/${handoverId}/qa`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ question }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Q&A inquiry failed' }));
    throw new Error(err.error || 'Q&A inquiry failed');
  }
  return res.json();
}

export async function fetchRedactedAuditLog(handoverId: string): Promise<RedactedAuditLogEntry[]> {
  const res = await fetch(`${API_BASE}/handovers/${handoverId}/audit-log`, {
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch redacted audit history');
  return res.json();
}

export function getMarkdownExportUrl(handoverId: string): string {
  return `${API_BASE}/handovers/${handoverId}/export/markdown`;
}

export function getPdfExportUrl(handoverId: string): string {
  return `${API_BASE}/handovers/${handoverId}/export/pdf`;
}

export async function downloadHandoverMarkdown(handoverId: string): Promise<void> {
  const res = await fetch(getMarkdownExportUrl(handoverId), {
    headers: getHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Export failed' }));
    throw new Error(err.error || 'Export failed');
  }
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `handover-${handoverId}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}
