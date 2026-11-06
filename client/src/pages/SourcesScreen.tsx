import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchSources, fetchProjects, ingestSource } from '../lib/api.js';
import { ClearanceBadge } from '../components/Badges.js';
import { Database, Plus, ShieldAlert, FileText, ChevronDown, ChevronUp, Check } from 'lucide-react';
import { ClearanceLevel } from '@prasaranam/shared';

export const SourcesScreen: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedProjectId, setSelectedProjectId] = useState('proj-solarpulse-01');
  const [filterClearance, setFilterClearance] = useState<string>('all');
  const [expandedSourceId, setExpandedSourceId] = useState<string | null>('src-arch-rfc-internal');

  // Ingestion form state
  const [title, setTitle] = useState('');
  const [sourceType, setSourceType] = useState('doc');
  const [clearanceLevel, setClearanceLevel] = useState<ClearanceLevel>('internal');
  const [author, setAuthor] = useState('');
  const [rawContent, setRawContent] = useState('');
  const [showForm, setShowForm] = useState(false);

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => fetchProjects(),
  });

  const { data: sources = [], isLoading } = useQuery({
    queryKey: ['sources-all', selectedProjectId],
    queryFn: () => fetchSources(selectedProjectId),
    enabled: Boolean(selectedProjectId),
  });

  const ingestMutation = useMutation({
    mutationFn: ingestSource,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sources-all', selectedProjectId] });
      setTitle('');
      setRawContent('');
      setAuthor('');
      setShowForm(false);
    },
  });

  const handleIngest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !rawContent.trim()) return;

    ingestMutation.mutate({
      project_id: selectedProjectId,
      title: title.trim(),
      source_type: sourceType,
      clearance_level: clearanceLevel,
      author: author.trim() || 'Synthetic System Ingest',
      raw_content: rawContent.trim(),
    });
  };

  const filteredSources = filterClearance === 'all'
    ? sources
    : sources.filter(s => s.clearance_level === filterClearance);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
            Knowledge Sources & Ingestion Hub
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Browse imported raw documents, segmented passages, and clearance classifications.
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-bold text-sm min-h-[44px] min-w-[44px] transition shadow-sm"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span>{showForm ? 'Cancel Ingestion' : 'Ingest Synthetic Source'}</span>
        </button>
      </div>

      {/* Untrusted Data Notice (Rule 2) */}
      <div className="p-4 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200">
        <div className="flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="space-y-1">
            <h2 className="text-sm font-bold">Rule 2: Untrusted Content Isolation Policy</h2>
            <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-300">
              Imported sources are treated strictly as untrusted data. Any instructions, prompt injections, or override commands within source texts (e.g. in the HSM recovery notes) are safely isolated in protective XML delimiters and never executed. The model has zero authority to approve records.
            </p>
          </div>
        </div>
      </div>

      {/* Ingestion Form (Rule 13: stack vertically, labels above inputs, touch targets >= 44x44px) */}
      {showForm && (
        <form onSubmit={handleIngest} className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4 animate-in fade-in">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Ingest New Synthetic Knowledge Source
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="source-title-input" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Document Title
              </label>
              <input
                id="source-title-input"
                type="text"
                placeholder="e.g. Battery Inverter Firmware Calibration Guide"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white min-h-[44px] text-sm focus:ring-2 focus:ring-sky-500"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="source-author-input" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Author / Origin
              </label>
              <input
                id="source-author-input"
                type="text"
                placeholder="e.g. Alex Mercer"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white min-h-[44px] text-sm focus:ring-2 focus:ring-sky-500"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="source-type-select" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Source Type
              </label>
              <select
                id="source-type-select"
                value={sourceType}
                onChange={(e) => setSourceType(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white min-h-[44px] text-sm focus:ring-2 focus:ring-sky-500"
              >
                <option value="doc">Technical Document</option>
                <option value="chat">Chat Transcript</option>
                <option value="meeting_notes">Meeting Notes</option>
                <option value="ticket">Ticket / Issue</option>
                <option value="email">Email</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="source-clearance-select" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Clearance Classification (Rule 1 Enforced)
              </label>
              <select
                id="source-clearance-select"
                value={clearanceLevel}
                onChange={(e) => setClearanceLevel(e.target.value as ClearanceLevel)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white min-h-[44px] text-sm focus:ring-2 focus:ring-sky-500"
              >
                <option value="public">Public (Open Volunteer Access)</option>
                <option value="internal">Internal (Internal Project Members)</option>
                <option value="confidential">Confidential (Senior Core Team)</option>
                <option value="restricted">Restricted (Project Lead / Security Only)</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="source-content-area" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Raw Source Content (will be automatically chunked and indexed into verifiable passages)
            </label>
            <textarea
              id="source-content-area"
              rows={4}
              placeholder="Paste document text or meeting conversation..."
              value={rawContent}
              onChange={(e) => setRawContent(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white min-h-[44px] text-sm focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:text-slate-900 dark:text-slate-300 min-h-[44px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={ingestMutation.isPending}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-bold text-sm min-h-[44px]"
            >
              <Check className="w-4 h-4" />
              <span>Ingest & Segment Passages</span>
            </button>
          </div>
        </form>
      )}

      {/* Project selector & Clearance filter tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-sky-600" aria-hidden="true" />
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="text-sm font-semibold bg-transparent border-0 focus:ring-0 text-slate-900 dark:text-white min-h-[44px]"
          >
            {projects.map(p => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {['all', 'public', 'internal', 'confidential', 'restricted'].map((lvl) => (
            <button
              key={lvl}
              onClick={() => setFilterClearance(lvl)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize min-h-[44px] min-w-[44px] transition ${
                filterClearance === lvl
                  ? 'bg-sky-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {lvl}
            </button>
          ))}
        </div>
      </div>

      {/* Sources List */}
      {isLoading ? (
        <div className="p-8 text-center text-slate-500 animate-pulse">Loading sources and passages...</div>
      ) : filteredSources.length === 0 ? (
        <div className="p-8 text-center text-slate-500 bg-white dark:bg-slate-900 rounded-xl border">
          No sources found matching selected clearance filter.
        </div>
      ) : (
        <div className="space-y-4">
          {filteredSources.map((source) => {
            const isExpanded = expandedSourceId === source.id;
            return (
              <div
                key={source.id}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden"
              >
                <div
                  onClick={() => setExpandedSourceId(isExpanded ? null : source.id)}
                  className="p-5 flex items-start justify-between gap-3 cursor-pointer hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      setExpandedSourceId(isExpanded ? null : source.id);
                    }
                  }}
                  aria-expanded={isExpanded}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-sky-600 shrink-0" aria-hidden="true" />
                      <h3 className="font-bold text-base text-slate-900 dark:text-white">
                        {source.title}
                      </h3>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span>Author: {source.author}</span>
                      <span>•</span>
                      <span className="capitalize">Type: {source.source_type}</span>
                      <span>•</span>
                      <span>{source.passages.length} Indexed Passages</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <ClearanceBadge level={source.clearance_level} />
                    <button
                      className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-white min-h-[44px] min-w-[44px] flex items-center justify-center"
                      aria-label={isExpanded ? 'Collapse source details' : 'Expand source details'}
                    >
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30 space-y-4">
                    <div>
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">
                        Indexed Verifiable Passages (for Exact Quotation Substring Matching)
                      </span>
                      <div className="space-y-2">
                        {source.passages.map((p) => (
                          <div
                            key={p.id}
                            className="p-3.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-1 text-xs"
                          >
                            <div className="flex items-center justify-between font-mono text-slate-400 text-[11px]">
                              <span>Passage ID: {p.id} (Offset: {p.char_start}..{p.char_end})</span>
                              <ClearanceBadge level={p.clearance_level} />
                            </div>
                            <p className="text-slate-800 dark:text-slate-200 leading-relaxed font-sans text-sm">
                              {p.text_content}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
