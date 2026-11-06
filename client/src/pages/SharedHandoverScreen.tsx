import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchHandover,
  fetchPassage,
  acknowledgeHandover,
  askGroundedQuestion,
  fetchRedactedAuditLog,
  downloadHandoverMarkdown,
  getPdfExportUrl,
} from '../lib/api.js';
import { useAuth } from '../context/AuthContext.js';
import { VerificationBadge, HandoverStatusBadge, ItemTypeBadge, ClearanceBadge } from '../components/Badges.js';
import { FallbackAlert } from '../components/FallbackAlert.js';
import { EvidenceDrawer } from '../components/EvidenceDrawer.js';
import {
  ArrowLeft,
  Quote,
  UserCheck,
  Bookmark,
  Lightbulb,
  HelpCircle,
  FileText,
  GitBranch,
  Clock,
  AlertOctagon,
  Layers,
  ShieldAlert,
  Users,
  Edit3,
  Lock,
  CheckCircle2,
  Send,
  AlertCircle,
  Download,
  Printer,
  History,
  Sparkles,
  X,
} from 'lucide-react';
import {
  QuotationEvidence,
  HandoverItem,
  Passage,
  HandoverSection,
  QuestionAnswerResponse,
  RedactedAuditLogEntry,
} from '@prasaranam/shared';

const SECTION_CONFIG: Record<
  HandoverSection,
  { label: string; icon: React.FC<{ className?: string }>; description: string }
> = {
  project_snapshot: {
    label: 'Project Snapshot',
    icon: FileText,
    description: 'Executive overview and current operational baseline',
  },
  decisions_rationale: {
    label: 'Decisions & Rationale',
    icon: GitBranch,
    description: 'Architectural, technical, and process decisions with source citations',
  },
  work_in_progress: {
    label: 'Work in Progress',
    icon: Clock,
    description: 'Active features, open PRs, and in-flight migrations',
  },
  blockers: {
    label: 'Blockers',
    icon: AlertOctagon,
    description: 'Critical impediments, deadlocks, and pending access requests',
  },
  dependencies: {
    label: 'Dependencies',
    icon: Layers,
    description: 'External APIs, database replicas, vendor contracts, and services',
  },
  risks: {
    label: 'Risks',
    icon: ShieldAlert,
    description: 'Operational vulnerabilities, single points of failure, and compliance gaps',
  },
  owners_contacts: {
    label: 'Owners & Contacts',
    icon: Users,
    description: 'Verified subsystem owners established by source passages',
  },
  unresolved_questions: {
    label: 'Unresolved Questions',
    icon: HelpCircle,
    description: 'Ambiguities and missing documentation flagged as unknown or conflicting',
  },
  suggested_next_actions: {
    label: 'Suggested Next Actions',
    icon: Lightbulb,
    description: 'Actionable suggestions for onboarding and transition',
  },
};

const ORDERED_SECTIONS: HandoverSection[] = [
  'project_snapshot',
  'decisions_rationale',
  'work_in_progress',
  'blockers',
  'dependencies',
  'risks',
  'owners_contacts',
  'unresolved_questions',
  'suggested_next_actions',
];

export const SharedHandoverScreen: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [selectedQuotation, setSelectedQuotation] = useState<QuotationEvidence | null>(null);
  const [selectedPassage, setSelectedPassage] = useState<Passage | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<string>('');
  const [isEvidenceOpen, setIsEvidenceOpen] = useState(false);

  // Recipient acknowledgement form state
  const [ackNotes, setAckNotes] = useState('');
  const [ackError, setAckError] = useState<string | null>(null);

  // Grounded Q&A state
  const [qaQuestion, setQaQuestion] = useState('');
  const [qaResult, setQaResult] = useState<QuestionAnswerResponse | null>(null);
  const [qaError, setQaError] = useState<string | null>(null);

  // Redacted Audit History modal state
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [auditLogs, setAuditLogs] = useState<RedactedAuditLogEntry[]>([]);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);

  const { data: plan, isLoading, error } = useQuery({
    queryKey: ['handover', id],
    queryFn: () => fetchHandover(id!),
    enabled: Boolean(id),
  });

  const ackMutation = useMutation({
    mutationFn: (notes?: string) =>
      acknowledgeHandover(id!, { notes }, user?.id || plan?.recipient_user_id),
    onSuccess: () => {
      setAckError(null);
      queryClient.invalidateQueries({ queryKey: ['handover', id] });
      queryClient.invalidateQueries({ queryKey: ['handovers'] });
    },
    onError: (err: Error) => {
      setAckError(err.message || 'Failed to confirm receipt');
    },
  });

  const handleOpenEvidence = async (quote: QuotationEvidence, item: HandoverItem) => {
    setSelectedQuotation(quote);
    setSelectedTopic(item.topic);
    setIsEvidenceOpen(true);
    if (quote.is_source_accessible === false) {
      setSelectedPassage(null);
      return;
    }
    try {
      const p = await fetchPassage(quote.passage_id);
      setSelectedPassage(p);
    } catch {
      setSelectedPassage(null);
    }
  };

  const handleConfirmReceipt = (e: React.FormEvent) => {
    e.preventDefault();
    ackMutation.mutate(ackNotes.trim() || undefined);
  };

  const qaMutation = useMutation({
    mutationFn: (questionText: string) => askGroundedQuestion(id!, questionText, user?.id),
    onSuccess: (data) => {
      setQaResult(data);
      setQaError(null);
    },
    onError: (err: Error) => {
      setQaError(err.message || 'Grounded inquiry failed');
    },
  });

  const handleAskQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!qaQuestion.trim()) return;
    qaMutation.mutate(qaQuestion.trim());
  };

  const handleOpenAudit = async () => {
    setIsAuditModalOpen(true);
    setIsLoadingAudit(true);
    try {
      const logs = await fetchRedactedAuditLog(id!);
      setAuditLogs(logs);
    } catch {
      setAuditLogs([]);
    } finally {
      setIsLoadingAudit(false);
    }
  };

  const handleDownloadMarkdown = async () => {
    try {
      await downloadHandoverMarkdown(id!);
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    }
  };

  const handlePrintPdf = () => {
    window.open(getPdfExportUrl(id!), '_blank');
  };

  if (isLoading) {
    return <div className="max-w-4xl mx-auto px-4 py-12 text-center text-slate-500 animate-pulse">Loading handover...</div>;
  }

  if (error || !plan) {
    const errorMsg = (error as any)?.message || 'Handover not found or inaccessible.';
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center space-y-4">
        <p className="text-rose-600 font-semibold">{errorMsg}</p>
        <Link to="/" className="text-sky-600 underline">Return Home</Link>
      </div>
    );
  }

  // Filter out any rejected items just in case
  const activeItems = plan.items.filter((it) => it.reviewer_status !== 'rejected');

  // Group items by section
  const itemsBySection = ORDERED_SECTIONS.reduce((acc, sectionKey) => {
    acc[sectionKey] = activeItems.filter((item) => (item.section || 'decisions_rationale') === sectionKey);
    return acc;
  }, {} as Record<HandoverSection, HandoverItem[]>);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <Link
          to={`/handovers/${plan.id}`}
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 min-h-[44px]"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>Back to Audit Review</span>
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <button
            id="btn-export-markdown"
            onClick={handleDownloadMarkdown}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 min-h-[44px] transition shadow-sm focus-visible:ring-2 focus-visible:ring-sky-500 outline-none"
            title="Download Authenticated Markdown"
            aria-label="Export Handover as Markdown"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Export Markdown</span>
          </button>
          <button
            id="btn-export-pdf"
            onClick={handlePrintPdf}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 min-h-[44px] transition shadow-sm focus-visible:ring-2 focus-visible:ring-sky-500 outline-none"
            title="Print or Save as PDF"
            aria-label="Print or Save as PDF"
          >
            <Printer className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Print / PDF</span>
          </button>
          <button
            id="btn-view-audit-log"
            onClick={handleOpenAudit}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 min-h-[44px] transition shadow-sm focus-visible:ring-2 focus-visible:ring-sky-500 outline-none"
            title="View Redacted Audit History"
            aria-label="View Redacted Audit History"
          >
            <History className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Audit History</span>
          </button>
          <ClearanceBadge level={plan.recipient_clearance} />
          <HandoverStatusBadge status={plan.status} />
        </div>
      </div>

      {/* Stale Handover Warning (Phase 6 Invariant) */}
      {plan.is_stale && (
        <div
          role="alert"
          className="p-4 rounded-xl border-2 border-rose-500 bg-rose-50 dark:bg-rose-950/60 text-rose-900 dark:text-rose-100 flex items-start gap-3 shadow-sm"
        >
          <ShieldAlert className="w-6 h-6 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="space-y-1">
            <h3 className="font-bold text-sm sm:text-base">Handover Content Marked Stale</h3>
            <p className="text-xs sm:text-sm text-rose-800 dark:text-rose-200">
              {plan.stale_reason || 'Recipient permissions have changed. This handover must be regenerated and re-approved before acting on its contents.'}
            </p>
          </div>
        </div>
      )}

      <FallbackAlert isFallback={plan.generated_with_fallback} />

      {/* Recipient Welcome Header */}
      <div className="p-6 sm:p-8 rounded-2xl bg-gradient-to-r from-sky-700 to-indigo-900 text-white shadow-lg space-y-4">
        <div className="flex items-center gap-2">
          <Bookmark className="w-5 h-5 text-sky-200" aria-hidden="true" />
          <span className="text-xs uppercase tracking-wider font-semibold text-sky-200">
            Official Knowledge Handover Document
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold">{plan.title}</h1>
        <p className="text-sky-100 text-sm sm:text-base leading-relaxed">
          Prepared specifically for <span className="font-bold underline">{plan.recipient_user_name}</span>.
          Approved by human reviewer <span className="font-semibold">{plan.reviewer_user_name || 'Sarah Chen'}</span> on{' '}
          {plan.approved_at ? new Date(plan.approved_at).toLocaleDateString() : 'Verification Date'}.
        </p>
      </div>

      {/* Recipient Acknowledgement of Receipt Card (Phase 5 Requirement) */}
      <div className="p-6 rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
        {plan.acknowledged_at ? (
          <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 space-y-2">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
              <div>
                <h3 className="font-bold text-base">Handover Formally Acknowledged</h3>
                <p className="text-xs text-emerald-700 dark:text-emerald-300">
                  Confirmed by <span className="font-semibold">{plan.acknowledged_by || plan.recipient_user_name}</span> on{' '}
                  {new Date(plan.acknowledged_at).toLocaleDateString()} at{' '}
                  {new Date(plan.acknowledged_at).toLocaleTimeString()}
                </p>
              </div>
            </div>
            {plan.acknowledged_notes && (
              <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 italic pt-1 pl-8 border-t border-emerald-200 dark:border-emerald-800">
                "{plan.acknowledged_notes}"
              </p>
            )}
          </div>
        ) : (
          <form onSubmit={handleConfirmReceipt} className="space-y-4">
            <div className="flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-sky-600 dark:text-sky-400" aria-hidden="true" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Acknowledgement of Receipt (Formal Sign-Off)
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              As the incoming recipient ({plan.recipient_user_name}), please confirm that you have reviewed the verified statements, owner responsibilities, and source citations below.
            </p>

            {ackError && (
              <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950 border border-rose-300 text-rose-800 dark:text-rose-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{ackError}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="ack-notes-input" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Recipient Confirmation Notes (Optional)
              </label>
              <input
                id="ack-notes-input"
                type="text"
                placeholder="e.g. Reviewed active telemetry pipelines and validated local staging access."
                value={ackNotes}
                onChange={(e) => setAckNotes(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm min-h-[44px] focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <button
              id="btn-confirm-acknowledgement"
              type="submit"
              disabled={ackMutation.isPending}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-sm min-h-[44px] min-w-[44px] transition shadow-sm"
            >
              {ackMutation.isPending ? (
                <span>Recording Confirmation...</span>
              ) : (
                <>
                  <Send className="w-4 h-4" aria-hidden="true" />
                  <span>Confirm Handover Receipt</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>

      {/* Executive Summary */}
      <div className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-2">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Executive Summary
        </h2>
        <p className="text-slate-800 dark:text-slate-200 text-sm sm:text-base leading-relaxed">
          {plan.summary}
        </p>
      </div>

      {/* Grounded Recipient Q&A (Rule 1 & Rule 2 Compliant) */}
      <div className="p-6 rounded-2xl border-2 border-indigo-200 dark:border-indigo-900 bg-white dark:bg-slate-900 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
            Grounded Recipient Q&A (Verified Evidence Only)
          </h2>
        </div>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          Ask questions about this project. Answers come <strong>strictly from authorized, verified source evidence</strong>. If there is not enough evidence, the system returns <em>insufficient evidence</em> and never guesses.
        </p>

        <form onSubmit={handleAskQuestion} className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              id="qa-question-input"
              type="text"
              placeholder="e.g. How often does telemetry process MQTT payloads? Or who manages database backups?"
              value={qaQuestion}
              onChange={(e) => setQaQuestion(e.target.value)}
              className="flex-1 px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm min-h-[44px] focus-visible:ring-2 focus-visible:ring-sky-500 outline-none"
              aria-label="Inquire about project knowledge"
            />
            <button
              id="btn-ask-question"
              type="submit"
              disabled={qaMutation.isPending || !qaQuestion.trim()}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-sm min-h-[44px] min-w-[44px] transition shadow-sm focus-visible:ring-2 focus-visible:ring-sky-500 outline-none"
            >
              {qaMutation.isPending ? (
                <span>Retrieving Evidence...</span>
              ) : (
                <>
                  <Send className="w-4 h-4" aria-hidden="true" />
                  <span>Ask Verified Evidence</span>
                </>
              )}
            </button>
          </div>
        </form>

        {qaError && (
          <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950 border border-rose-300 text-rose-800 dark:text-rose-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{qaError}</span>
          </div>
        )}

        {qaResult && (
          <div
            id="grounded-qa-result-card"
            className={`p-4 rounded-xl border-2 space-y-3 ${
              qaResult.insufficient_evidence
                ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-100'
                : 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-100'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-700/60">
              <span className="text-xs font-semibold">
                Question: <em>"{qaResult.question}"</em>
              </span>
              {qaResult.insufficient_evidence ? (
                <div id="qa-insufficient-evidence" className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100">
                  <HelpCircle className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>INSUFFICIENT EVIDENCE (UNSUPPORTED)</span>
                </div>
              ) : (
                <div id="qa-verified-evidence" className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-200 dark:bg-emerald-800 text-emerald-900 dark:text-emerald-100">
                  <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>VERIFIED EVIDENCE (SUPPORTED)</span>
                </div>
              )}
            </div>

            <p className="text-sm font-medium leading-relaxed">
              {qaResult.answer}
            </p>

            {qaResult.evidence && qaResult.evidence.length > 0 && (
              <div className="space-y-1.5 pt-2 border-t border-slate-200 dark:border-slate-700/60">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Citations ({qaResult.evidence.length})
                </span>
                <div className="flex flex-wrap gap-2">
                  {qaResult.evidence.map((ev, idx) => (
                    <button
                      key={idx}
                      id="qa-open-citation"
                      data-testid="qa-evidence-citation-btn"
                      onClick={() => {
                        setSelectedQuotation(ev);
                        setSelectedTopic(qaResult.question);
                        setIsEvidenceOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 min-h-[44px] transition focus-visible:ring-2 focus-visible:ring-sky-500 outline-none"
                    >
                      <Quote className="w-3.5 h-3.5 text-sky-500" aria-hidden="true" />
                      <span>{ev.source_title}: "{ev.quote.slice(0, 45)}..."</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sections and Statements */}
      <div className="space-y-8">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Verified Handover Statements & Actions ({activeItems.length})
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Every statement links to verified source evidence. Evidence links check clearance on every read.
          </p>
        </div>

        {ORDERED_SECTIONS.map((sectionKey) => {
          const items = itemsBySection[sectionKey] || [];
          if (items.length === 0) return null;
          const conf = SECTION_CONFIG[sectionKey];
          const Icon = conf.icon;

          return (
            <div key={sectionKey} className="space-y-4">
              {/* Section Header */}
              <div className="flex items-center gap-2.5 pb-2 border-b border-slate-200 dark:border-slate-800">
                <div className="p-1.5 rounded-lg bg-sky-50 dark:bg-sky-950 text-sky-600 dark:text-sky-400">
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>{conf.label}</span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      {items.length}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{conf.description}</p>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-4">
                {items.map((item) => {
                  const isSuggestion = item.is_suggestion || item.section === 'suggested_next_actions';
                  const isUnknown = item.verification_status === 'unknown';

                  return (
                    <div
                      key={item.id}
                      className={`p-5 rounded-xl border bg-white dark:bg-slate-900 shadow-sm space-y-3 ${
                        isSuggestion
                          ? 'border-purple-300 dark:border-purple-800/60'
                          : isUnknown
                          ? 'border-amber-300 dark:border-amber-800/60'
                          : 'border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <ItemTypeBadge type={item.item_type} />
                          {isSuggestion && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-900 dark:bg-purple-950 dark:text-purple-200">
                              <Lightbulb className="w-3 h-3" />
                              <span>SUGGESTION</span>
                            </span>
                          )}
                          {isUnknown && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                              <HelpCircle className="w-3 h-3" />
                              <span>UNKNOWN</span>
                            </span>
                          )}
                          <h4 className="font-bold text-base text-slate-900 dark:text-white">
                            {item.topic}
                          </h4>
                        </div>
                        <VerificationBadge status={item.verification_status} />
                      </div>

                      <p className="text-sm sm:text-base text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
                        {item.statement}
                      </p>

                      {/* Reviewer Context Note if edited */}
                      {item.reviewer_context && (
                        <div className="p-2.5 rounded-lg border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/40 text-xs text-sky-900 dark:text-sky-200 flex items-center gap-2">
                          <Edit3 className="w-4 h-4 text-sky-600 shrink-0" />
                          <span>
                            Updated by reviewer <span className="font-semibold">{item.reviewer_context.reviewer_name}</span> for clarity.
                          </span>
                        </div>
                      )}

                      {/* Verified Owner (Rule 5: explicit assignment only) */}
                      {item.owner && item.owner !== 'unknown' && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 font-semibold bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-3 py-1.5 rounded-lg w-fit">
                          <UserCheck className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                          <span>Assigned Owner: {item.owner}</span>
                        </div>
                      )}

                      {/* Exact Quotation Anchors with dynamic clearance check */}
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                          Citations (Click to inspect verbatim source passage):
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {item.quotations.map((q, idx) => {
                            const isAccessible = q.is_source_accessible !== false;

                            return isAccessible ? (
                              <button
                                key={idx}
                                data-testid="evidence-link-btn"
                                onClick={() => handleOpenEvidence(q, item)}
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-sky-50 dark:bg-sky-950/80 hover:bg-sky-100 dark:hover:bg-sky-900 text-sky-800 dark:text-sky-200 text-xs font-medium border border-sky-200 dark:border-sky-800 min-h-[44px] transition"
                              >
                                <Quote className="w-3.5 h-3.5 text-sky-600" aria-hidden="true" />
                                <span className="truncate max-w-[200px] sm:max-w-xs">"{q.quote}"</span>
                              </button>
                            ) : (
                              <button
                                key={idx}
                                data-testid="evidence-link-btn"
                                onClick={() => handleOpenEvidence(q, item)}
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 text-xs font-medium border border-rose-200 dark:border-rose-800 min-h-[44px] transition"
                                title="Passage restricted by clearance policy"
                              >
                                <Lock className="w-3.5 h-3.5 text-rose-500" aria-hidden="true" />
                                <span>Restricted Source (Unavailable)</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Evidence Drawer Sheet (Rule 14) */}
      <EvidenceDrawer
        isOpen={isEvidenceOpen}
        onClose={() => setIsEvidenceOpen(false)}
        quotation={selectedQuotation}
        passage={selectedPassage}
        itemTopic={selectedTopic}
      />

      {/* Redacted Audit History Modal */}
      {isAuditModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="audit-history-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
        >
          <div
            id="audit-modal"
            className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
          >
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-sky-600 dark:text-sky-400" aria-hidden="true" />
                <h3 id="audit-history-title" className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  Redacted Handover Audit History
                </h3>
              </div>
              <button
                id="btn-close-audit-modal"
                onClick={() => setIsAuditModalOpen(false)}
                className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 min-h-[44px] min-w-[44px] flex items-center justify-center focus-visible:ring-2 focus-visible:ring-sky-500 outline-none"
                aria-label="Close audit history"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
              <div className="p-3 rounded-lg bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 text-xs text-sky-900 dark:text-sky-200">
                All raw passages, quotes, and confidential tokens are systematically redacted from audit logs.
              </div>

              {isLoadingAudit ? (
                <div className="text-center py-8 text-xs text-slate-500 animate-pulse">Loading audit history...</div>
              ) : auditLogs.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500">No audit entries found.</div>
              ) : (
                <div className="space-y-3">
                  {auditLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-1.5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-bold text-xs uppercase px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                          {log.action}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {new Date(log.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200">
                        {log.details}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Actor: <strong>{log.performed_by}</strong>
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setIsAuditModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 min-h-[44px] focus-visible:ring-2 focus-visible:ring-sky-500 outline-none"
              >
                Close Audit Log
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
