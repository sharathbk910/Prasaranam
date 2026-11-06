import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  ExtractionJob,
} from '@prasaranam/shared';
import {
  fetchExtractionJobs,
  startExtractionJob,
  retryExtractionJob,
} from '../lib/api.js';
import {
  Sparkles,
  Play,
  RotateCw,
  Clock,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  FileCheck2,
  Layers,
  ArrowRight,
} from 'lucide-react';

interface ExtractionJobPanelProps {
  projectId: string;
  projectName: string;
}

export const ExtractionJobPanel: React.FC<ExtractionJobPanelProps> = ({ projectId, projectName }) => {
  const queryClient = useQueryClient();
  const [showConfig, setShowConfig] = useState(false);
  const [forceFallback, setForceFallback] = useState(true);
  const [customTitle, setCustomTitle] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: jobs = [], isLoading: isLoadingJobs } = useQuery<ExtractionJob[]>({
    queryKey: ['extraction-jobs', projectId],
    queryFn: () => fetchExtractionJobs(projectId),
    refetchInterval: (query) => {
      const activeJobs = (query.state.data as ExtractionJob[] | undefined)?.some(
        j => j.status === 'queued' || j.status === 'running'
      );
      return activeJobs ? 1000 : 5000;
    },
  });

  const startMutation = useMutation({
    mutationFn: () => startExtractionJob(projectId, forceFallback, customTitle.trim() || undefined),
    onSuccess: () => {
      setShowConfig(false);
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ['extraction-jobs', projectId] });
      queryClient.invalidateQueries({ queryKey: ['handovers', projectId] });
    },
    onError: (err: any) => {
      setActionError(err.message || 'Failed to start extraction.');
    },
  });

  const retryMutation = useMutation({
    mutationFn: (jobId: string) => retryExtractionJob(projectId, jobId),
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ['extraction-jobs', projectId] });
    },
    onError: (err: any) => {
      setActionError(err.message || 'Failed to retry extraction.');
    },
  });

  const latestJob = jobs.length > 0 ? jobs[0] : null;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-6 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              Knowledge Reconstruction Pipeline
            </h3>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            Reconstruct verified decisions, tasks, blockers, and gap detections from authorized source chunks.
          </p>
        </div>

        <button
          onClick={() => setShowConfig(prev => !prev)}
          id="btn-run-extraction"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs sm:text-sm shadow-sm transition-colors min-h-[44px] min-w-[44px] touch-manipulation self-start sm:self-auto"
        >
          <Play className="w-4 h-4" />
          <span>{showConfig ? 'Close Extraction' : 'Run Extraction'}</span>
        </button>
      </div>

      {actionError && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 rounded-lg text-rose-700 dark:text-rose-400 text-xs sm:text-sm flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Configuration Form (Mobile friendly stacked) */}
      {showConfig && (
        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 sm:p-5 rounded-lg border border-slate-200 dark:border-slate-700 space-y-4">
          <h4 className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white">
            Reconstruction Configuration
          </h4>

          <div className="space-y-3">
            <div>
              <label htmlFor="extraction-title" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Handover Plan Title (Optional)
              </label>
              <input
                id="extraction-title"
                type="text"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder={`Reconstructed Handover: ${projectName}`}
                className="w-full px-3 py-2 text-xs sm:text-sm rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[44px]"
              />
            </div>

            <div className="flex items-start gap-3 p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
              <input
                id="force-fallback-checkbox"
                type="checkbox"
                checked={forceFallback}
                onChange={(e) => setForceFallback(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <label htmlFor="force-fallback-checkbox" className="text-xs text-slate-600 dark:text-slate-300">
                <span className="font-semibold block text-slate-900 dark:text-white">
                  Deterministic Fallback Extraction Mode
                </span>
                Extracts knowledge using deterministic offline rule engine. Strictly labeled as <strong className="text-amber-700 dark:text-amber-400">NOT A LIVE AI RESULT</strong> per project specifications.
              </label>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-2">
            <button
              onClick={() => setShowConfig(false)}
              className="px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs sm:text-sm font-semibold min-h-[44px]"
            >
              Cancel
            </button>
            <button
              id="btn-confirm-start-extraction"
              onClick={() => startMutation.mutate()}
              disabled={startMutation.isPending}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-xs sm:text-sm shadow-sm min-h-[44px]"
            >
              {startMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Initiating Job...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  <span>Start Extraction</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Latest Job Status Card */}
      {isLoadingJobs ? (
        <div className="p-4 text-center text-xs sm:text-sm text-slate-500 animate-pulse">
          Loading pipeline job history...
        </div>
      ) : latestJob ? (
        <div
          data-testid="extraction-job-status-card"
          className="p-4 sm:p-5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {latestJob.status === 'queued' && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Status: Queued</span>
                </div>
              )}
              {latestJob.status === 'running' && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Status: Extracting Knowledge...</span>
                </div>
              )}
              {latestJob.status === 'completed' && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Status: Extraction Completed</span>
                </div>
              )}
              {latestJob.status === 'failed' && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Status: Extraction Failed</span>
                </div>
              )}

              <span className="text-xs text-slate-500">
                Job ID: {latestJob.id}
              </span>
            </div>

            {/* Fallback Badge per Rule 7 */}
            {latestJob.is_fallback && (
              <div
                data-testid="fallback-label-badge"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wide uppercase bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-800"
              >
                <AlertCircle className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
                <span>NOT A LIVE AI RESULT</span>
              </div>
            )}
          </div>

          {/* Progress Bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
              <span>Pipeline Progress</span>
              <span className="font-semibold">{latestJob.progress_pct}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  latestJob.status === 'failed'
                    ? 'bg-rose-500'
                    : latestJob.status === 'completed'
                    ? 'bg-emerald-500'
                    : 'bg-indigo-600'
                }`}
                style={{ width: `${latestJob.progress_pct}%` }}
              />
            </div>
          </div>

          {/* Job Error Output */}
          {latestJob.error_message && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 text-xs sm:text-sm text-rose-700 dark:text-rose-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{latestJob.error_message}</span>
            </div>
          )}

          {/* Action Row */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
            <div className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-2">
              <Layers className="w-3.5 h-3.5" />
              <span>Extracted Items: <strong className="text-slate-900 dark:text-white">{latestJob.items_count}</strong></span>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <button
                id="btn-retry-extraction"
                onClick={() => retryMutation.mutate(latestJob.id)}
                disabled={retryMutation.isPending || latestJob.status === 'running'}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors disabled:opacity-50 min-h-[44px]"
              >
                <RotateCw className={`w-3.5 h-3.5 ${retryMutation.isPending ? 'animate-spin' : ''}`} />
                <span>Retry Pipeline</span>
              </button>

              {latestJob.handover_id && (
                <Link
                  to={`/handovers/${latestJob.handover_id}`}
                  id="btn-view-extracted-handover"
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm shadow-sm min-h-[44px]"
                >
                  <FileCheck2 className="w-4 h-4" />
                  <span>Review Extracted Handover</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-6 border border-dashed border-slate-200 dark:border-slate-800 rounded-lg text-slate-500 space-y-2">
          <p className="text-xs sm:text-sm">No knowledge reconstruction jobs run for this project yet.</p>
          <button
            onClick={() => setShowConfig(true)}
            className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline min-h-[44px] inline-flex items-center"
          >
            Launch first reconstruction extraction
          </button>
        </div>
      )}
    </div>
  );
};

