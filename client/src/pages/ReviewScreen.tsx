import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchHandover, reviewHandover, fetchPassage, fetchClarificationQuestions } from '../lib/api.js';
import { VerificationBadge, ClearanceBadge, HandoverStatusBadge, ItemTypeBadge } from '../components/Badges.js';
import { FallbackAlert } from '../components/FallbackAlert.js';
import { EvidenceDrawer } from '../components/EvidenceDrawer.js';
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Share2,
  UserCheck,
  Quote,
  History,
  MessageSquare,
  Edit3,
  X,
  XCircle,
  Check,
  HelpCircle,
  Lightbulb,
  GitBranch,
  Clock,
  AlertOctagon,
  Layers,
  ShieldAlert,
  Users,
  FileText,
  Shield,
  Info,
} from 'lucide-react';
import { HandoverItem, QuotationEvidence, Passage, HandoverSection } from '@prasaranam/shared';

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

export const ReviewScreen: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Active quotation state for the Evidence Drawer
  const [selectedQuotation, setSelectedQuotation] = useState<QuotationEvidence | null>(null);
  const [selectedPassage, setSelectedPassage] = useState<Passage | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<string>('');
  const [isEvidenceOpen, setIsEvidenceOpen] = useState(false);

  // Review note input for whole draft sign-off
  const [reviewNote, setReviewNote] = useState('');

  // Per-item editing modal state
  const [editingItem, setEditingItem] = useState<HandoverItem | null>(null);
  const [editedStatement, setEditedStatement] = useState('');
  const [editRationale, setEditRationale] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: plan, isLoading, error } = useQuery({
    queryKey: ['handover', id],
    queryFn: () => fetchHandover(id!),
    enabled: Boolean(id),
  });

  const { data: clarificationQuestions = [] } = useQuery({
    queryKey: ['clarifications', id],
    queryFn: () => fetchClarificationQuestions(id!),
    enabled: Boolean(id),
  });

  const reviewMutation = useMutation({
    mutationFn: (actionPayload: any) => reviewHandover(id!, actionPayload, 'user-sarah-reviewer'),
    onSuccess: () => {
      setActionError(null);
      setEditingItem(null);
      queryClient.invalidateQueries({ queryKey: ['handover', id] });
      queryClient.invalidateQueries({ queryKey: ['handovers'] });
    },
    onError: (err: Error) => {
      setActionError(err.message || 'Review action failed');
    },
  });

  // Handle escape key to close edit modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && editingItem) {
        setEditingItem(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editingItem]);

  const handleOpenEvidence = async (quote: QuotationEvidence, item: HandoverItem) => {
    setSelectedQuotation(quote);
    setSelectedTopic(item.topic);
    setIsEvidenceOpen(true);
    try {
      const p = await fetchPassage(quote.passage_id);
      setSelectedPassage(p);
    } catch {
      setSelectedPassage(null);
    }
  };

  const handleStartEdit = (item: HandoverItem) => {
    setEditingItem(item);
    setEditedStatement(item.statement);
    setEditRationale('');
    setActionError(null);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    if (!editedStatement.trim()) {
      setActionError('Statement cannot be empty.');
      return;
    }
    reviewMutation.mutate({
      action: 'edit_item',
      item_id: editingItem.id,
      edited_statement: editedStatement.trim(),
      comment: editRationale.trim() || undefined,
      reviewer_name: 'Sarah Chen (Lead Reviewer)',
    });
  };

  const handleApproveItem = (itemId: string) => {
    setActionError(null);
    reviewMutation.mutate({
      action: 'approve_item',
      item_id: itemId,
      reviewer_name: 'Sarah Chen (Lead Reviewer)',
    });
  };

  const handleRejectItem = (itemId: string) => {
    setActionError(null);
    reviewMutation.mutate({
      action: 'reject_item',
      item_id: itemId,
      reviewer_name: 'Sarah Chen (Lead Reviewer)',
    });
  };

  const handleApproveWholeDraft = () => {
    setActionError(null);
    reviewMutation.mutate({
      action: 'approve',
      comment: reviewNote.trim() || 'All statements verified against authorized source passages. Approved.',
      reviewer_name: 'Sarah Chen (Lead Reviewer)',
    });
  };

  const handleRequestChanges = () => {
    setActionError(null);
    reviewMutation.mutate({
      action: 'request_changes',
      comment: reviewNote.trim() || 'Corrections requested by reviewer.',
      reviewer_name: 'Sarah Chen (Lead Reviewer)',
    });
  };

  const handleShare = () => {
    setActionError(null);
    reviewMutation.mutate({
      action: 'share',
      comment: reviewNote.trim() || 'Handover shared with recipient.',
      reviewer_name: 'Sarah Chen (Lead Reviewer)',
    });
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 text-center text-slate-500 animate-pulse">
        Loading handover plan and quotation evidence...
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center space-y-4">
        <p className="text-rose-600 font-semibold">Handover plan not found or inaccessible.</p>
        <Link to="/" className="inline-flex items-center gap-2 text-sky-600 underline">
          Return to Dashboard
        </Link>
      </div>
    );
  }

  // Factual items calculations for whole draft approval guard (Phase 4 requirement)
  const factualItems = plan.items.filter(
    (it) => !it.is_suggestion && it.section !== 'suggested_next_actions' && it.reviewer_status !== 'rejected'
  );
  const approvedOrUnknown = factualItems.filter(
    (it) =>
      it.reviewer_status === 'approved' ||
      it.reviewer_status === 'edited' ||
      it.reviewer_status === 'accepted' ||
      it.verification_status === 'unknown'
  );
  const pendingFactualCount = factualItems.length - approvedOrUnknown.length;
  const canApproveDraft = pendingFactualCount === 0;

  // Group items by section
  const itemsBySection = ORDERED_SECTIONS.reduce((acc, sectionKey) => {
    acc[sectionKey] = plan.items.filter((item) => (item.section || 'decisions_rationale') === sectionKey);
    return acc;
  }, {} as Record<HandoverSection, HandoverItem[]>);

  // Fallback for any items in unknown sections
  const otherItems = plan.items.filter(
    (item) => !ORDERED_SECTIONS.includes(item.section as HandoverSection)
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white min-h-[44px] min-w-[44px]"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>Dashboard</span>
        </button>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-full text-xs font-bold border border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
            v{plan.version_number || 1}
          </span>
          <HandoverStatusBadge status={plan.status} />
          {plan.status === 'shared' && (
            <Link
              to={`/handovers/${plan.id}/shared`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs min-h-[44px]"
            >
              <Share2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Recipient View</span>
            </Link>
          )}
        </div>
      </div>

      {/* Visible Non-AI Fallback Warning Banner (Rule 7) */}
      <FallbackAlert isFallback={plan.generated_with_fallback} />

      {/* Staleness / Permission Invalidation Notice */}
      {plan.is_stale && (
        <div
          role="alert"
          className="p-4 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 flex items-start gap-2.5 text-sm"
        >
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="font-bold">Handover Version Stale / Invalidation Notice</p>
            <p className="text-xs sm:text-sm mt-0.5">
              {plan.stale_reason || 'Recipient permissions have changed. Recipient access is blocked until re-generated and re-approved.'}
            </p>
          </div>
        </div>
      )}

      {/* Version Increment & Re-approval Notice */}
      {Boolean(plan.version_number && plan.version_number > 1 && plan.status === 'under_review') && (
        <div
          role="alert"
          className="p-4 rounded-xl border border-blue-300 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 flex items-start gap-2.5 text-sm"
        >
          <History className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="font-bold">New Version Draft (v{plan.version_number}) — Re-approval Required</p>
            <p className="text-xs sm:text-sm mt-0.5">
              Previous approved version (v{(plan.version_number || 2) - 1}) was modified by reviewer edit. This new draft must be completely reviewed and approved before sharing.
            </p>
          </div>
        </div>
      )}

      {/* Action Error Banner */}
      {actionError && (
        <div
          role="alert"
          className="p-4 rounded-xl border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 flex items-center justify-between text-sm"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" aria-hidden="true" />
            <span>{actionError}</span>
          </div>
          <button
            onClick={() => setActionError(null)}
            className="p-1 rounded hover:bg-rose-100 dark:hover:bg-rose-900 text-rose-700 dark:text-rose-300 min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Dismiss error"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Card */}
      <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-xs font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider">
              {plan.project_name}
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-0.5">
              {plan.title}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Recipient Clearance:</span>
            <ClearanceBadge level={plan.recipient_clearance} />
          </div>
        </div>

        {/* Participants metadata */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs sm:text-sm">
          <div>
            <span className="text-slate-500 dark:text-slate-400 font-semibold">Departing Member:</span>
            <p className="font-bold text-slate-900 dark:text-white mt-0.5">{plan.departing_user_name}</p>
          </div>
          <div>
            <span className="text-slate-500 dark:text-slate-400 font-semibold">Incoming Recipient:</span>
            <p className="font-bold text-sky-600 dark:text-sky-400 mt-0.5">{plan.recipient_user_name}</p>
          </div>
          <div>
            <span className="text-slate-500 dark:text-slate-400 font-semibold">Assigned Reviewer:</span>
            <p className="font-bold text-slate-900 dark:text-white mt-0.5">{plan.reviewer_user_name || 'Sarah Chen'}</p>
          </div>
        </div>

        {/* Summary */}
        <div className="space-y-1">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Reconstructed Project State Summary
          </span>
          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
            {plan.summary}
          </p>
        </div>
      </div>

      {/* Clarification Questions Card (Phase 6 Gap Detection) */}
      {clarificationQuestions.length > 0 && (
        <div className="p-5 rounded-2xl border border-amber-200 dark:border-amber-800/60 bg-amber-50/50 dark:bg-amber-950/20 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Detected Knowledge Gaps & Clarification Questions ({clarificationQuestions.length})
              </h2>
            </div>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300">
              Needs Clarification
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
            These targeted questions highlight missing rationale, unassigned task owners, or conflicting timeline dates identified during evidence synthesis.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            {clarificationQuestions.map((cq) => (
              <div
                key={cq.id}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2 shadow-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    {cq.gap_type.replace('_', ' ')}
                  </span>
                  <span className="text-xs font-semibold text-slate-500 truncate max-w-[160px]">
                    {cq.topic}
                  </span>
                </div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white leading-snug">
                  {cq.question}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                  Suggested Action: {cq.suggested_action}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reviewer Action & Whole-Draft Sign-off Bar (Phase 4 Approval Guard) */}
      <div className="p-5 rounded-xl border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Human Reviewer Workspace & Approval Guard
            </h2>
          </div>
          {/* Progress Pill */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
            <span>Factual Verification:</span>
            <span className={canApproveDraft ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>
              {approvedOrUnknown.length} of {factualItems.length} approved / unknown
            </span>
          </div>
        </div>

        {/* Phase 4 Rule: Approve draft ONLY when every factual item is approved or explicitly marked unknown */}
        {!canApproveDraft && (
          <div className="p-3.5 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 text-xs sm:text-sm flex items-start gap-2.5">
            <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="font-semibold">Whole-draft approval requirement:</p>
              <p className="mt-0.5">
                {pendingFactualCount} factual statement{pendingFactualCount > 1 ? 's' : ''} still require review.
                Approve, edit, or reject each item below before final sign-off. (Items marked unknown do not block approval).
              </p>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <label htmlFor="reviewer-note-input" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
            Reviewer Audit Decision Note
          </label>
          <input
            id="reviewer-note-input"
            type="text"
            placeholder="Add review feedback, verification notes, or sign-off comment..."
            value={reviewNote}
            onChange={(e) => setReviewNote(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm min-h-[44px] focus:ring-2 focus:ring-sky-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            onClick={handleApproveWholeDraft}
            disabled={!canApproveDraft || plan.status === 'approved' || plan.status === 'shared' || reviewMutation.isPending}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-sm min-h-[44px] min-w-[44px] transition"
            title={!canApproveDraft ? `Please review remaining ${pendingFactualCount} factual items` : 'Approve complete handover draft'}
          >
            <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
            <span>Approve Entire Draft</span>
          </button>

          <button
            onClick={handleRequestChanges}
            disabled={plan.status === 'changes_requested' || reviewMutation.isPending}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white font-semibold text-sm min-h-[44px] min-w-[44px] transition"
          >
            <AlertTriangle className="w-4 h-4" aria-hidden="true" />
            <span>Request Changes</span>
          </button>

          {plan.status === 'approved' && (
            <button
              onClick={handleShare}
              disabled={reviewMutation.isPending}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-bold text-sm min-h-[44px] min-w-[44px] transition shadow-md"
            >
              <Share2 className="w-4 h-4" aria-hidden="true" />
              <span>Share with {plan.recipient_user_name}</span>
            </button>
          )}
        </div>
      </div>

      {/* Sections & Statements Review Workspace */}
      <div className="space-y-8">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
            Handover Review Workspace ({plan.items.length} Total Items)
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Inspect source passages, edit statements with reviewer attribution, or reject incorrect records.
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
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
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
              </div>

              {/* Desktop Table (>= 768px) per Rule 12 */}
              <div className="hidden md:block overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th scope="col" className="px-5 py-3.5 w-1/4">Topic & Classification</th>
                      <th scope="col" className="px-5 py-3.5 w-2/5">Statement & Reviewer Context</th>
                      <th scope="col" className="px-5 py-3.5 w-1/6">Verified Owner</th>
                      <th scope="col" className="px-5 py-3.5 w-1/5 text-right">Review Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {items.map((item) => {
                      const isSuggestion = item.is_suggestion || item.section === 'suggested_next_actions';
                      const isUnknown = item.verification_status === 'unknown';

                      return (
                        <tr
                          key={item.id}
                          className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition ${
                            item.reviewer_status === 'rejected' ? 'opacity-60 bg-rose-50/20' : ''
                          }`}
                        >
                          {/* Column 1: Topic & Classification */}
                          <td className="px-5 py-4 align-top">
                            <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                              <ItemTypeBadge type={item.item_type} />
                              {/* Prominent SUGGESTION label (Phase 4 requirement) */}
                              {isSuggestion && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-900 dark:bg-purple-950 dark:text-purple-200 border border-purple-300 dark:border-purple-800">
                                  <Lightbulb className="w-3 h-3 text-purple-600 dark:text-purple-400" aria-hidden="true" />
                                  <span>SUGGESTION</span>
                                </span>
                              )}
                              {/* Prominent UNKNOWN label (Phase 4 requirement) */}
                              {isUnknown && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 border border-amber-300 dark:border-amber-800">
                                  <HelpCircle className="w-3 h-3 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                                  <span>UNKNOWN</span>
                                </span>
                              )}
                            </div>
                            <div className="font-bold text-slate-900 dark:text-white">{item.topic}</div>
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              <VerificationBadge status={item.verification_status} />
                              {item.reviewer_status && item.reviewer_status !== 'pending' && (
                                <span
                                  className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                                    item.reviewer_status === 'approved'
                                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                      : item.reviewer_status === 'rejected'
                                      ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                      : 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300'
                                  }`}
                                >
                                  {item.reviewer_status.toUpperCase()}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Column 2: Statement & Reviewer Context */}
                          <td className="px-5 py-4 align-top space-y-2">
                            <p className="text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
                              {item.statement}
                            </p>

                            {/* Reviewer Context Banner if edited (Phase 4 Rule: never overwrites original source) */}
                            {item.reviewer_context && (
                              <div className="p-2.5 rounded-lg border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/40 text-xs text-sky-900 dark:text-sky-200 space-y-1">
                                <div className="font-bold flex items-center gap-1.5">
                                  <Edit3 className="w-3.5 h-3.5 text-sky-600" />
                                  <span>Reviewer Edit Context (Original Source Intact)</span>
                                </div>
                                <p className="text-[11px] text-sky-700 dark:text-sky-300">
                                  Edited by <span className="font-semibold">{item.reviewer_context.reviewer_name}</span> on{' '}
                                  {new Date(item.reviewer_context.edited_at).toLocaleDateString()}
                                </p>
                                <div className="text-[11px] font-mono text-slate-600 dark:text-slate-400 bg-white/70 dark:bg-slate-900/60 p-1.5 rounded">
                                  Original: "{item.reviewer_context.original_statement}"
                                </div>
                              </div>
                            )}

                            {item.reviewer_notes && !item.reviewer_context && (
                              <p className="text-xs text-slate-500 italic flex items-center gap-1">
                                <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                                <span>Note: {item.reviewer_notes}</span>
                              </p>
                            )}
                          </td>

                          {/* Column 3: Verified Owner */}
                          <td className="px-5 py-4 align-top">
                            {/* Rule 5: Show owner only when source establishes assignment */}
                            {item.owner && item.owner !== 'unknown' ? (
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-medium text-xs">
                                <UserCheck className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                                <span>{item.owner}</span>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400 italic">Unassigned (Authorship not owner)</span>
                            )}
                          </td>

                          {/* Column 4: Review Actions & Evidence */}
                          <td className="px-5 py-4 align-top text-right space-y-2">
                            {/* Evidence Links */}
                            <div className="flex flex-col items-end gap-1">
                              {item.quotations.map((q, qIndex) => (
                                <button
                                  key={qIndex}
                                  data-testid="inspect-evidence-btn"
                                  onClick={() => handleOpenEvidence(q, item)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/80 dark:hover:bg-sky-900 text-sky-700 dark:text-sky-300 text-xs font-semibold min-h-[44px] min-w-[44px] transition"
                                >
                                  <Quote className="w-3.5 h-3.5" aria-hidden="true" />
                                  <span>Inspect Passage</span>
                                </button>
                              ))}
                            </div>

                            {/* Per-item review controls */}
                            <div className="flex items-center justify-end gap-1.5 pt-1">
                              <button
                                type="button"
                                data-testid="item-approve-btn"
                                onClick={() => handleApproveItem(item.id)}
                                disabled={item.reviewer_status === 'approved' || reviewMutation.isPending}
                                className={`inline-flex items-center justify-center p-2 rounded-lg text-xs font-bold min-h-[44px] min-w-[44px] transition ${
                                  item.reviewer_status === 'approved'
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                    : 'bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-800 dark:bg-slate-800 dark:hover:bg-emerald-950 dark:text-slate-300 dark:hover:text-emerald-300'
                                }`}
                                title="Approve this item"
                                aria-label={`Approve ${item.topic}`}
                              >
                                <Check className="w-4 h-4" />
                              </button>

                              <button
                                type="button"
                                data-testid="item-edit-btn"
                                onClick={() => handleStartEdit(item)}
                                disabled={reviewMutation.isPending}
                                className="inline-flex items-center justify-center p-2 rounded-lg text-xs font-bold bg-slate-100 hover:bg-sky-100 text-slate-700 hover:text-sky-800 dark:bg-slate-800 dark:hover:bg-sky-950 dark:text-slate-300 dark:hover:text-sky-300 min-h-[44px] min-w-[44px] transition"
                                title="Edit this item (attaches reviewer context)"
                                aria-label={`Edit ${item.topic}`}
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>

                              <button
                                type="button"
                                data-testid="item-reject-btn"
                                onClick={() => handleRejectItem(item.id)}
                                disabled={item.reviewer_status === 'rejected' || reviewMutation.isPending}
                                className={`inline-flex items-center justify-center p-2 rounded-lg text-xs font-bold min-h-[44px] min-w-[44px] transition ${
                                  item.reviewer_status === 'rejected'
                                    ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                    : 'bg-slate-100 hover:bg-rose-100 text-slate-700 hover:text-rose-800 dark:bg-slate-800 dark:hover:bg-rose-950 dark:text-slate-300 dark:hover:text-rose-300'
                                }`}
                                title="Reject this item (exclude from approved draft)"
                                aria-label={`Reject ${item.topic}`}
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Stacked Cards (< 768px) per Rule 12 */}
              <div className="md:hidden space-y-4">
                {items.map((item) => {
                  const isSuggestion = item.is_suggestion || item.section === 'suggested_next_actions';
                  const isUnknown = item.verification_status === 'unknown';

                  return (
                    <div
                      key={item.id}
                      className={`p-4 sm:p-5 rounded-xl border bg-white dark:bg-slate-900 shadow-sm space-y-3.5 ${
                        item.reviewer_status === 'rejected'
                          ? 'border-rose-200 dark:border-rose-900/60 opacity-60'
                          : isSuggestion
                          ? 'border-purple-300 dark:border-purple-800/60'
                          : isUnknown
                          ? 'border-amber-300 dark:border-amber-800/60'
                          : 'border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      {/* Card Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-1.5">
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
                          </div>
                          <h4 className="font-bold text-slate-900 dark:text-white text-base">
                            {item.topic}
                          </h4>
                        </div>
                        <VerificationBadge status={item.verification_status} />
                      </div>

                      {/* Statement */}
                      <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
                        {item.statement}
                      </p>

                      {/* Reviewer Context Banner */}
                      {item.reviewer_context && (
                        <div className="p-3 rounded-lg border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/40 text-xs text-sky-900 dark:text-sky-200 space-y-1">
                          <div className="font-bold flex items-center gap-1">
                            <Edit3 className="w-3.5 h-3.5 text-sky-600" />
                            <span>Reviewer Edit Context (Original Source Intact)</span>
                          </div>
                          <p className="text-[11px] text-sky-700 dark:text-sky-300">
                            By {item.reviewer_context.reviewer_name} on {new Date(item.reviewer_context.edited_at).toLocaleDateString()}
                          </p>
                          <div className="text-[11px] font-mono text-slate-600 dark:text-slate-400 bg-white/70 dark:bg-slate-900/60 p-1.5 rounded">
                            Original: "{item.reviewer_context.original_statement}"
                          </div>
                        </div>
                      )}

                      {/* Owner Attribution Check */}
                      <div className="text-xs pt-1 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
                        <span className="text-slate-500 font-semibold">Assigned Owner:</span>
                        {item.owner && item.owner !== 'unknown' ? (
                          <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1">
                            <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                            {item.owner}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">No explicit assignment</span>
                        )}
                      </div>

                      {/* Evidence Passage Buttons (>= 44x44px touch targets) */}
                      <div className="space-y-1.5 pt-1">
                        {item.quotations.map((q, qIndex) => (
                          <button
                            key={qIndex}
                            data-testid="inspect-evidence-btn"
                            onClick={() => handleOpenEvidence(q, item)}
                            className="w-full inline-flex items-center justify-between px-3.5 py-2.5 rounded-lg bg-sky-50 dark:bg-sky-950 text-sky-800 dark:text-sky-200 text-xs font-semibold min-h-[44px] min-w-[44px] border border-sky-200 dark:border-sky-800"
                          >
                            <span className="truncate pr-2">Passage: {q.source_title}</span>
                            <span className="shrink-0 flex items-center gap-1 text-sky-600 font-bold">
                              <Quote className="w-3.5 h-3.5" />
                              Inspect
                            </span>
                          </button>
                        ))}
                      </div>

                      {/* Review Action Buttons for Mobile (stacked cards with large touch-friendly buttons >= 44x44px) */}
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          data-testid="item-approve-btn"
                          onClick={() => handleApproveItem(item.id)}
                          disabled={item.reviewer_status === 'approved' || reviewMutation.isPending}
                          className={`inline-flex items-center justify-center gap-1 px-3 py-2.5 rounded-lg text-xs font-bold min-h-[44px] transition ${
                            item.reviewer_status === 'approved'
                              ? 'bg-emerald-600 text-white'
                              : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Approve</span>
                        </button>

                        <button
                          type="button"
                          data-testid="item-edit-btn"
                          onClick={() => handleStartEdit(item)}
                          disabled={reviewMutation.isPending}
                          className="inline-flex items-center justify-center gap-1 px-3 py-2.5 rounded-lg text-xs font-bold bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-800 min-h-[44px] transition"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>

                        <button
                          type="button"
                          data-testid="item-reject-btn"
                          onClick={() => handleRejectItem(item.id)}
                          disabled={item.reviewer_status === 'rejected' || reviewMutation.isPending}
                          className={`inline-flex items-center justify-center gap-1 px-3 py-2.5 rounded-lg text-xs font-bold min-h-[44px] transition ${
                            item.reviewer_status === 'rejected'
                              ? 'bg-rose-600 text-white'
                              : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                          }`}
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Reject</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Any Other Items */}
        {otherItems.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Additional Statements</h3>
          </div>
        )}
      </div>

      {/* Human Review Audit History */}
      <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-slate-500" aria-hidden="true" />
          <h3 className="font-bold text-sm text-slate-900 dark:text-white">
            Human Review Audit History
          </h3>
        </div>
        <div className="space-y-2 text-xs">
          {plan.audit_logs.map((log) => (
            <div
              key={log.id}
              className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-1"
            >
              <div>
                <span className="font-bold text-slate-800 dark:text-slate-200">{log.action}: </span>
                <span className="text-slate-600 dark:text-slate-300">{log.details}</span>
              </div>
              <div className="text-slate-400 font-mono shrink-0">
                {new Date(log.timestamp).toLocaleTimeString()} ({log.performed_by})
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Per-Item Edit Modal (Phase 4 requirement: reviewer context, never overwrites original source) */}
      {editingItem && (
        <div
          role="dialog"
          aria-labelledby="edit-dialog-title"
          aria-modal="true"
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-sky-600 dark:text-sky-400" />
                <h3 id="edit-dialog-title" className="text-base font-bold text-slate-900 dark:text-white">
                  Edit Handover Statement
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Close edit dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
              {/* Provenance Notice */}
              <div className="p-3 rounded-lg border border-sky-200 dark:border-sky-900 bg-sky-50 dark:bg-sky-950/40 text-xs text-sky-900 dark:text-sky-200 flex items-start gap-2.5">
                <Shield className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Reviewer Attribution Guarantee:</span>
                  <p className="mt-0.5">
                    Your edit will be attached as reviewer context citing Sarah Chen. Original source passages in the database remain strictly immutable.
                  </p>
                </div>
              </div>

              {/* Statement */}
              <div className="space-y-1.5">
                <label htmlFor="edit-statement" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Updated Handover Statement *
                </label>
                <textarea
                  id="edit-statement"
                  rows={4}
                  value={editedStatement}
                  onChange={(e) => setEditedStatement(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-sky-500 min-h-[44px]"
                  required
                />
              </div>

              {/* Reviewer Rationale */}
              <div className="space-y-1.5">
                <label htmlFor="edit-rationale" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Reviewer Rationale / Context Note (Optional)
                </label>
                <input
                  id="edit-rationale"
                  type="text"
                  placeholder="e.g. Clarified schedule based on architecture sync call"
                  value={editRationale}
                  onChange={(e) => setEditRationale(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-sky-500 min-h-[44px]"
                />
              </div>

              {/* Actions */}
              <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-sm min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reviewMutation.isPending}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-bold text-sm min-h-[44px] transition"
                >
                  {reviewMutation.isPending ? 'Saving...' : 'Save Reviewer Edit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Evidence Drawer Sheet (Rule 14: full-screen sheet on mobile, side panel on desktop, closes with button & Escape) */}
      <EvidenceDrawer
        isOpen={isEvidenceOpen}
        onClose={() => setIsEvidenceOpen(false)}
        quotation={selectedQuotation}
        passage={selectedPassage}
        itemTopic={selectedTopic}
      />
    </div>
  );
};
