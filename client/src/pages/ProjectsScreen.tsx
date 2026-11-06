import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { fetchProjects, createProject } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.js';
import {
  FolderKanban,
  Plus,
  ArrowRight,
  Shield,
  Clock,
  AlertCircle,
  X,
  Check,
} from 'lucide-react';

export const ProjectsScreen: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const { data: projects = [], isLoading, error } = useQuery({
    queryKey: ['projects'],
    queryFn: () => fetchProjects(),
  });

  const createMutation = useMutation({
    mutationFn: createProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setName('');
      setDescription('');
      setFormError(null);
      setShowCreateModal(false);
    },
    onError: (err: any) => {
      setFormError(err.message || 'Failed to create project');
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) {
      setFormError('Project name must be at least 2 characters');
      return;
    }
    if (description.trim().length < 5) {
      setFormError('Description must be at least 5 characters');
      return;
    }
    createMutation.mutate({
      name: name.trim(),
      description: description.trim(),
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            My Project Workspaces
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Projects you are an authorized member of. Multi-tenant Row-Level Security (RLS) is active.
          </p>
        </div>

        <button
          onClick={() => {
            setShowCreateModal(true);
            setFormError(null);
          }}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-bold text-sm min-h-[44px] min-w-[44px] shadow-sm transition"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span>New Project</span>
        </button>
      </div>

      {/* RLS Security Indicator */}
      <div className="p-3.5 rounded-xl border border-sky-200 dark:border-sky-900 bg-sky-50 dark:bg-sky-950/40 text-sky-900 dark:text-sky-200 flex items-center gap-3 text-xs sm:text-sm">
        <Shield className="w-5 h-5 text-sky-600 shrink-0" aria-hidden="true" />
        <span>
          Authenticated as <strong>{user?.name}</strong>. Only projects where you hold membership are returned by the server database.
        </span>
      </div>

      {/* Create Project Modal / Drawer */}
      {showCreateModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in"
        >
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
              <h2 id="modal-title" className="font-bold text-base sm:text-lg text-slate-900 dark:text-white">
                Create New Project Workspace
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Form Stacking (Rule 13: labels above inputs, touch target >= 44x44px) */}
              <div className="space-y-1.5">
                <label htmlFor="proj-name-input" className="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Project Name
                </label>
                <input
                  id="proj-name-input"
                  type="text"
                  required
                  placeholder="e.g. Clinic Solar Grid Alpha"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm min-h-[44px] focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="proj-desc-input" className="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Project Description & Knowledge Scope
                </label>
                <textarea
                  id="proj-desc-input"
                  rows={3}
                  required
                  placeholder="Describe the operational goals, components, and purpose..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm min-h-[44px] focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-semibold min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-bold text-sm min-h-[44px]"
                >
                  <Check className="w-4 h-4" />
                  <span>{createMutation.isPending ? 'Creating...' : 'Create Project'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Projects List: Follows responsive rules (Rule 9, 10, 12) */}
      {isLoading ? (
        <div className="p-12 text-center text-slate-500 animate-pulse">Loading your projects...</div>
      ) : error ? (
        <div className="p-6 rounded-xl border border-rose-300 bg-rose-50 text-rose-800 text-center">
          Failed to load projects. Please refresh.
        </div>
      ) : projects.length === 0 ? (
        <div className="p-10 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-center space-y-4 bg-white dark:bg-slate-900">
          <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
            <FolderKanban className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="font-bold text-base text-slate-900 dark:text-white">No projects found</h3>
            <p className="text-xs sm:text-sm text-slate-500">
              You are not a member of any projects yet. Create your first project workspace to begin.
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-bold text-sm min-h-[44px]"
          >
            <Plus className="w-4 h-4" />
            <span>Create First Project</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <div
              key={project.id}
              className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col justify-between space-y-4 hover:border-sky-500/50 transition group"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="w-9 h-9 rounded-xl bg-sky-100 dark:bg-sky-950 flex items-center justify-center text-sky-600 dark:text-sky-300">
                    <FolderKanban className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    Member Access
                  </span>
                </div>
                <h3 className="font-bold text-lg text-slate-900 dark:text-white group-hover:text-sky-600 transition">
                  {project.name}
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 line-clamp-3 leading-relaxed">
                  {project.description}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-400 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{new Date(project.created_at).toLocaleDateString()}</span>
                </span>

                <Link
                  to={`/projects/${project.id}`}
                  className="inline-flex items-center gap-1 font-bold text-sky-600 hover:text-sky-800 dark:text-sky-400 p-2 min-h-[44px]"
                >
                  <span>Open Workspace</span>
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

