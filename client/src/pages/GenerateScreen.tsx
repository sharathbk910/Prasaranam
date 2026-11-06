import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { fetchProjects, fetchUsers, fetchSources, generateHandover } from '../lib/api.js';
import { ClearanceBadge } from '../components/Badges.js';
import { Shield, Sparkles, AlertCircle, ArrowLeft, Lock, FileText, CheckCircle2, CheckSquare, Square } from 'lucide-react';
import { ClearanceLevel, HandoverSection } from '@prasaranam/shared';

const ALL_SECTIONS: Array<{ id: HandoverSection; label: string; description: string }> = [
  { id: 'project_snapshot', label: 'Project Snapshot', description: 'Executive summary & current operational baseline' },
  { id: 'decisions_rationale', label: 'Decisions & Rationale', description: 'Architecture, technical, and policy decisions' },
  { id: 'work_in_progress', label: 'Work in Progress', description: 'In-flight tasks, tickets, and active implementations' },
  { id: 'blockers', label: 'Blockers', description: 'Active defects, impediments, and critical obstacles' },
  { id: 'dependencies', label: 'Dependencies', description: 'External services, database replication, and protocols' },
  { id: 'risks', label: 'Risks', description: 'Operational, degradation, and compliance risk factors' },
  { id: 'owners_contacts', label: 'Owners & Contacts', description: 'Verified points of contact and subsystem assignments' },
  { id: 'unresolved_questions', label: 'Unresolved Questions', description: 'Identified gaps, ambiguities, and unknown procedures' },
  { id: 'suggested_next_actions', label: 'Suggested Next Actions', description: 'Forward recommendations for recipient (visually distinct)' },
];

export const GenerateScreen: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [projectId, setProjectId] = useState('proj-solarpulse-01');
  const [departingUserId, setDepartingUserId] = useState('user-alex-departing');
  const [recipientUserId, setRecipientUserId] = useState('user-maya-recipient-internal');
  const [reviewerUserId, setReviewerUserId] = useState('user-sarah-reviewer');
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [selectedSections, setSelectedSections] = useState<HandoverSection[]>(ALL_SECTIONS.map(s => s.id));

  const toggleSection = (sectionId: HandoverSection) => {
    setSelectedSections(prev =>
      prev.includes(sectionId) ? prev.filter(s => s !== sectionId) : [...prev, sectionId]
    );
  };

  const selectAllSections = () => setSelectedSections(ALL_SECTIONS.map(s => s.id));
  const deselectAllSections = () => setSelectedSections([]);

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => fetchProjects(),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => fetchUsers(),
  });

  const recipientUser = users.find(u => u.id === recipientUserId);
  const recipientClearance: ClearanceLevel = recipientUser?.clearance_level || 'internal';

  // Fetch sources filtered by recipient clearance (Rule 1)
  const { data: authorizedSources = [], isLoading: loadingSources } = useQuery({
    queryKey: ['sources', projectId, recipientClearance],
    queryFn: () => fetchSources(projectId, recipientClearance),
    enabled: Boolean(projectId),
  });

  // Fetch all sources for the project to display restricted isolation counter
  const { data: allProjectSources = [] } = useQuery({
    queryKey: ['sources-all', projectId],
    queryFn: () => fetchSources(projectId),
    enabled: Boolean(projectId),
  });

  const restrictedCount = allProjectSources.length - authorizedSources.length;

  const mutation = useMutation({
    mutationFn: generateHandover,
    onSuccess: (newPlan) => {
      queryClient.invalidateQueries({ queryKey: ['handovers'] });
      navigate(`/handovers/${newPlan.id}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalTitle = title.trim() || `Knowledge Handover: ${users.find(u => u.id === departingUserId)?.name} -> ${recipientUser?.name}`;
    mutation.mutate({
      project_id: projectId,
      departing_user_id: departingUserId,
      recipient_user_id: recipientUserId,
      reviewer_user_id: reviewerUserId || undefined,
      title: finalTitle,
      instructions: instructions.trim() || undefined,
      selected_sections: selectedSections.length > 0 ? selectedSections : undefined,
    });
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center justify-center min-h-[44px] min-w-[44px] p-2 rounded-lg text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          aria-label="Back to dashboard"
        >
          <ArrowLeft className="w-5 h-5" aria-hidden="true" />
        </button>
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">
            Reconstruct Project Knowledge Handover
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Synthesize recipient-specific records with strict pre-retrieval clearance filtering.
          </p>
        </div>
      </div>

      {/* Rule 1 Notice Box */}
      <div className="p-4 rounded-xl border border-sky-200 dark:border-sky-900 bg-sky-50 dark:bg-sky-950/40 text-sky-900 dark:text-sky-200 space-y-2">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="space-y-1">
            <h2 className="text-sm font-bold">Rule 1 Enforced: Pre-Retrieval Permissions Boundary</h2>
            <p className="text-xs leading-relaxed text-sky-800 dark:text-sky-300">
              Only documents matching or below the recipient's clearance level (
              <span className="font-semibold uppercase">{recipientClearance}</span>) will be retrieved.
              Restricted documents are blocked before prompt construction and never sent to the model.
            </p>
          </div>
        </div>
      </div>

      {/* Form (Stacked vertically on mobile with labels above inputs per Rule 13) */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-5">
          {/* Project Selection */}
          <div className="space-y-1.5">
            <label htmlFor="project-select" className="block text-sm font-semibold text-slate-800 dark:text-slate-200">
              Project Context
            </label>
            <select
              id="project-select"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white min-h-[44px] focus:ring-2 focus:ring-sky-500"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Departing Member */}
          <div className="space-y-1.5">
            <label htmlFor="departing-select" className="block text-sm font-semibold text-slate-800 dark:text-slate-200">
              Departing Team Member (Author/Subject)
            </label>
            <select
              id="departing-select"
              value={departingUserId}
              onChange={(e) => setDepartingUserId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white min-h-[44px] focus:ring-2 focus:ring-sky-500"
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role} - {u.clearance_level})
                </option>
              ))}
            </select>
          </div>

          {/* Recipient Member */}
          <div className="space-y-1.5">
            <label htmlFor="recipient-select" className="block text-sm font-semibold text-slate-800 dark:text-slate-200">
              Incoming Recipient Member (Determines Pre-Retrieval Clearance Filter)
            </label>
            <select
              id="recipient-select"
              value={recipientUserId}
              onChange={(e) => setRecipientUserId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white min-h-[44px] focus:ring-2 focus:ring-sky-500"
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} (Clearance: {u.clearance_level.toUpperCase()})
                </option>
              ))}
            </select>
            {recipientUser && (
              <div className="pt-1 flex items-center gap-2">
                <span className="text-xs text-slate-500">Recipient Clearance:</span>
                <ClearanceBadge level={recipientUser.clearance_level} />
              </div>
            )}
          </div>

          {/* Reviewer Member */}
          <div className="space-y-1.5">
            <label htmlFor="reviewer-select" className="block text-sm font-semibold text-slate-800 dark:text-slate-200">
              Designated Human Reviewer (Requires human sign-off before handover is shared)
            </label>
            <select
              id="reviewer-select"
              value={reviewerUserId}
              onChange={(e) => setReviewerUserId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white min-h-[44px] focus:ring-2 focus:ring-sky-500"
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role})
                </option>
              ))}
            </select>
          </div>

          {/* Title input */}
          <div className="space-y-1.5">
            <label htmlFor="handover-title" className="block text-sm font-semibold text-slate-800 dark:text-slate-200">
              Handover Title (Optional)
            </label>
            <input
              id="handover-title"
              type="text"
              placeholder="e.g. SolarPulse Telemetry Core Ingestion Handover"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white min-h-[44px] focus:ring-2 focus:ring-sky-500"
            />
          </div>

          {/* Special Focus */}
          <div className="space-y-1.5">
            <label htmlFor="instructions-text" className="block text-sm font-semibold text-slate-800 dark:text-slate-200">
              Synthesis Scope & Review Notes (Optional)
            </label>
            <textarea
              id="instructions-text"
              rows={3}
              placeholder="Focus on active operational pipelines, database backup routines, and unassigned backlog items."
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white min-h-[44px] focus:ring-2 focus:ring-sky-500"
            />
          </div>

          {/* Section Selection (Phase 4 requirement: choose which sections to include) */}
          <div className="space-y-3 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Sections to Include ({selectedSections.length} of {ALL_SECTIONS.length} selected)
                </label>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Customize the handover draft structure based on recipient onboarding needs.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={selectAllSections}
                  className="px-2.5 py-1.5 text-xs font-semibold rounded-md border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 min-h-[44px]"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={deselectAllSections}
                  className="px-2.5 py-1.5 text-xs font-semibold rounded-md border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 min-h-[44px]"
                >
                  Deselect All
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {ALL_SECTIONS.map((sec) => {
                const isSelected = selectedSections.includes(sec.id);
                return (
                  <button
                    type="button"
                    key={sec.id}
                    onClick={() => toggleSection(sec.id)}
                    aria-pressed={isSelected}
                    className={`flex items-start gap-3 p-3 text-left rounded-lg border transition min-h-[44px] ${
                      isSelected
                        ? 'border-sky-500 bg-sky-50/50 dark:bg-sky-950/30 text-slate-900 dark:text-white'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 text-slate-500 dark:text-slate-400 hover:border-slate-300'
                    }`}
                  >
                    <div className="mt-0.5 shrink-0 text-sky-600 dark:text-sky-400">
                      {isSelected ? (
                        <CheckSquare className="w-5 h-5" aria-hidden="true" />
                      ) : (
                        <Square className="w-5 h-5 text-slate-400 dark:text-slate-600" aria-hidden="true" />
                      )}
                    </div>
                    <div className="space-y-0.5">
                      <div className="text-xs sm:text-sm font-semibold">{sec.label}</div>
                      <div className="text-[11px] leading-tight text-slate-500 dark:text-slate-400">
                        {sec.description}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            {selectedSections.length === 0 && (
              <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">
                Please select at least one section to include in the handover draft.
              </p>
            )}
          </div>
        </div>

        {/* Live Clearance Filter Inspection Card */}
        <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-600 dark:text-slate-400" aria-hidden="true" />
              <span className="font-bold text-sm text-slate-900 dark:text-white">
                Authorized Sources for {recipientUser?.name} ({authorizedSources.length} accessible)
              </span>
            </div>
            {restrictedCount > 0 && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                <Lock className="w-3 h-3" aria-hidden="true" />
                {restrictedCount} Restricted Document{restrictedCount > 1 ? 's' : ''} Blocked
              </span>
            )}
          </div>

          {loadingSources ? (
            <div className="text-xs text-slate-500">Checking clearance boundaries...</div>
          ) : (
            <div className="space-y-2">
              {authorizedSources.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" aria-hidden="true" />
                    <span className="font-medium text-slate-800 dark:text-slate-200">{s.title}</span>
                  </div>
                  <ClearanceBadge level={s.clearance_level} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Error message */}
        {mutation.isError && (
          <div className="p-4 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 flex items-center gap-2 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0" aria-hidden="true" />
            <span>{(mutation.error as Error).message}</span>
          </div>
        )}

        {/* Submit Button */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={mutation.isPending}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-bold text-base min-h-[44px] min-w-[44px] shadow-sm transition"
          >
            {mutation.isPending ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Reconstructing Handover...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" aria-hidden="true" />
                <span>Generate Verified Handover</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

