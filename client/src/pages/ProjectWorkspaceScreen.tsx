import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchProject, fetchSources, fetchHandovers, searchProjectSources } from '../lib/api.js';
import { ClearanceBadge, HandoverStatusBadge } from '../components/Badges.js';
import { SourceImportModal } from '../components/SourceImportModal.js';
import { ExtractionJobPanel } from '../components/ExtractionJobPanel.js';
import {
  FolderKanban,
  Users,
  Database,
  Layers,
  PlusCircle,
  ArrowLeft,
  Shield,
  ShieldAlert,
  ArrowRight,
  UserCheck,
  Search,
  Upload,
  FileText,
  MapPin,
  Lock,
} from 'lucide-react';

export const ProjectWorkspaceScreen: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);

  const { data: project, isLoading, error } = useQuery({
    queryKey: ['project', id],
    queryFn: () => fetchProject(id!),
    enabled: Boolean(id),
    retry: false,
  });

  const { data: sources = [] } = useQuery({
    queryKey: ['sources-all', id],
    queryFn: () => fetchSources(id!),
    enabled: Boolean(project),
  });

  const { data: handovers = [] } = useQuery({
    queryKey: ['handovers', id],
    queryFn: () => fetchHandovers(id!),
    enabled: Boolean(project),
  });

  // Search query
  const { data: searchResults = [], isLoading: isSearching } = useQuery({
    queryKey: ['project-search', id, searchQuery],
    queryFn: () => searchProjectSources(id!, searchQuery),
    enabled: Boolean(project && searchQuery.trim().length > 0),
  });

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 text-center text-slate-500 animate-pulse">
        Checking membership and loading project workspace...
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          Access Restricted: Membership Required
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Row-Level Security (RLS) has blocked access to this project. You must hold an active membership in this workspace to view its contents.
        </p>
        <Link
          to="/projects"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-semibold text-sm min-h-[44px]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to My Projects</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <button
          onClick={() => navigate('/projects')}
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 min-h-[44px]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Projects</span>
        </button>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            id="open-source-import-btn"
            onClick={() => setShowImportModal(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-sm min-h-[44px] min-w-[44px] transition"
          >
            <Upload className="w-4 h-4 text-sky-600" />
            <span>Import Source</span>
          </button>

          <Link
            to="/generate"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-bold text-sm min-h-[44px] min-w-[44px] shadow-sm transition"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Generate Handover</span>
          </Link>
        </div>
      </div>

      {/* Project Overview Card */}
      <div className="p-6 sm:p-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-100 dark:bg-sky-950 flex items-center justify-center text-sky-600 dark:text-sky-300">
            <FolderKanban className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-sky-600 uppercase tracking-wider">
                Project Workspace
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-semibold">
                Member Verified
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
              {project.name}
            </h1>
          </div>
        </div>

        <p className="text-slate-700 dark:text-slate-300 text-sm sm:text-base leading-relaxed">
          {project.description}
        </p>

        <div className="flex flex-wrap items-center gap-4 pt-2 text-xs text-slate-500 border-t border-slate-100 dark:border-slate-800">
          <span className="flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-emerald-600" />
            <span>Row-Level Security Active</span>
          </span>
          <span>•</span>
          <span>Workspace: <code className="font-mono text-slate-700 dark:text-slate-300">{project.workspace_id || 'ws-default'}</code></span>
          <span>•</span>
          <span>Created: {new Date(project.created_at).toLocaleDateString()}</span>
        </div>
      </div>

      {/* Full-Text Search Section (Phase 2 Requirement) */}
      <div className="p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Search className="w-5 h-5 text-sky-600" />
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              Full-Text Search Across Authorized Sources
            </h2>
          </div>
          <span className="text-xs text-slate-500">
            Filtered by project membership & clearance
          </span>
        </div>

        {/* Search Input Box */}
        <div className="relative">
          <input
            id="workspace-search-input"
            type="search"
            placeholder="Search keywords across documents, issues, and chat transcripts (e.g. MQTT, buffer, thermal, battery)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-white text-sm min-h-[44px] focus:ring-2 focus:ring-sky-500"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
        </div>

        {/* Search Results Display */}
        {searchQuery.trim().length > 0 && (
          <div className="pt-2 space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-semibold">
                {isSearching
                  ? 'Searching passages...'
                  : `Found ${searchResults.length} matching passage${searchResults.length === 1 ? '' : 's'}`}
              </span>
            </div>

            {searchResults.length === 0 && !isSearching ? (
              <div className="p-6 text-center text-xs sm:text-sm text-slate-500 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700">
                No passages found matching "{searchQuery}" under your authorized access level.
              </div>
            ) : (
              /*
                Phase 2 Requirement: Search results follow responsive rules and are CARDS ON MOBILE
              */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {searchResults.map((result) => (
                  <div
                    key={result.passage_id}
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-800/50 space-y-2.5 shadow-sm text-xs"
                  >
                    {/* Source metadata header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                        <div>
                          <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                            {result.source_title}
                          </h3>
                          <span className="text-[11px] text-slate-500">
                            By {result.author} • {new Date(result.date).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <ClearanceBadge level={result.clearance_level} />
                    </div>

                    {/* Matched Snippet */}
                    <p className="text-slate-800 dark:text-slate-200 text-xs sm:text-sm font-sans leading-relaxed bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                      "{result.snippet}"
                    </p>

                    {/* Exact Character Position Indicator (Phase 2 Requirement) */}
                    <div className="pt-1.5 flex flex-wrap items-center justify-between gap-1 text-[11px] text-slate-500 border-t border-slate-200 dark:border-slate-700/60">
                      <span className="flex items-center gap-1 font-mono text-sky-700 dark:text-sky-300">
                        <MapPin className="w-3 h-3 text-sky-500" />
                        <span>Position: offsets [{result.char_start}..{result.char_end}]</span>
                      </span>
                      <span className="font-mono text-slate-400">
                        Passage ID: {result.passage_id.split('-').slice(0, 3).join('-')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Members & Access Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Authorized Project Members ({project.members?.length || 0})
            </h2>
          </div>
        </div>

        {/* Desktop Members Table (>= 768px) */}
        <div className="hidden md:block overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th scope="col" className="px-6 py-3.5">Member Name</th>
                <th scope="col" className="px-6 py-3.5">Email</th>
                <th scope="col" className="px-6 py-3.5">Project Role</th>
                <th scope="col" className="px-6 py-3.5">Clearance Level</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {project.members?.map((m: any) => (
                <tr key={m.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                  <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-emerald-600" />
                    <span>{m.user.name}</span>
                  </td>
                  <td className="px-6 py-4 text-xs font-mono">{m.user.email}</td>
                  <td className="px-6 py-4 capitalize font-medium">{m.role}</td>
                  <td className="px-6 py-4">
                    <ClearanceBadge level={m.user.clearance_level} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Members Stacked Cards (< 768px) */}
        <div className="md:hidden space-y-3">
          {project.members?.map((m: any) => (
            <div
              key={m.id}
              className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-2 text-xs"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-slate-900 dark:text-white">{m.user.name}</span>
                <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-semibold uppercase text-[10px]">
                  {m.role}
                </span>
              </div>
              <p className="text-slate-500 font-mono">{m.user.email}</p>
              <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800">
                <span className="text-slate-500 font-medium">Clearance:</span>
                <ClearanceBadge level={m.user.clearance_level} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Knowledge Reconstruction Extraction Pipeline (Phase 3) */}
      <ExtractionJobPanel projectId={project.id} projectName={project.name} />

      {/* Sources & Handovers Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Project Sources */}
        <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-sky-600" />
              <h2 className="font-bold text-base text-slate-900 dark:text-white">
                Knowledge Sources ({sources.length})
              </h2>
            </div>
            <button
              onClick={() => setShowImportModal(true)}
              className="text-xs text-sky-600 hover:underline min-h-[44px] flex items-center gap-1 font-semibold"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Import Source</span>
            </button>
          </div>

          <div className="space-y-2">
            {sources.map(s => (
              <div
                key={s.id}
                className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between text-xs"
              >
                <div className="truncate pr-2">
                  <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">{s.title}</p>
                  <p className="text-[11px] text-slate-500">{s.passages.length} verifiable chunks • By {s.author}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {s.visibility === 'restricted_members' && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-900 font-bold">
                      <Lock className="w-2.5 h-2.5" />
                      Restricted
                    </span>
                  )}
                  <ClearanceBadge level={s.clearance_level} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Project Handovers */}
        <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-600" />
              <h2 className="font-bold text-base text-slate-900 dark:text-white">
                Project Handovers ({handovers.length})
              </h2>
            </div>
            <Link to="/generate" className="text-xs text-sky-600 hover:underline min-h-[44px] flex items-center">
              + New Plan
            </Link>
          </div>

          <div className="space-y-2">
            {handovers.length === 0 ? (
              <p className="text-xs text-slate-500 italic p-4 text-center">
                No handovers generated yet for this project.
              </p>
            ) : (
              handovers.map(h => (
                <Link
                  key={h.id}
                  to={`/handovers/${h.id}`}
                  className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between text-xs hover:border-sky-500 transition group block"
                >
                  <div>
                    <p className="font-bold text-slate-900 dark:text-white group-hover:text-sky-600">{h.title}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {h.departing_user_name} ➔ {h.recipient_user_name} ({h.items.length} items)
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <HandoverStatusBadge status={h.status} />
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-sky-600" />
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Source Import Modal */}
      <SourceImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        projectId={project.id}
        projectMembers={project.members || []}
      />
    </div>
  );
};
