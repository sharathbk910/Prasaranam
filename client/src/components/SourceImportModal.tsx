import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { importProjectSource } from '../lib/api.js';
import { SourceType, SourceVisibility, ClearanceLevel } from '@prasaranam/shared';
import {
  X,
  Upload,
  FileText,
  FileCode,
  Clipboard,
  AlertCircle,
  CheckCircle2,
  Users,
  Lock,
} from 'lucide-react';

interface SourceImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectMembers: Array<{ user: { id: string; name: string }; role: string }>;
}

export const SourceImportModal: React.FC<SourceImportModalProps> = ({
  isOpen,
  onClose,
  projectId,
  projectMembers,
}) => {
  const queryClient = useQueryClient();

  const [sourceType, setSourceType] = useState<SourceType>('pasted_text');
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [rawContent, setRawContent] = useState('');
  const [clearanceLevel, setClearanceLevel] = useState<ClearanceLevel>('internal');
  const [visibility, setVisibility] = useState<SourceVisibility>('all_members');
  const [allowedMemberIds, setAllowedMemberIds] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const importMutation = useMutation({
    mutationFn: (payload: any) => importProjectSource(projectId, payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['sources-all', projectId] });
      queryClient.invalidateQueries({ queryKey: ['sources', projectId] });
      if (data.isDuplicate) {
        setSuccessNotice('Duplicate content detected! Linked to existing stored source with matching hash.');
      } else {
        setSuccessNotice(`Successfully imported and chunked into ${data.source.passages.length} verifiable passages.`);
      }
      setTimeout(() => {
        onClose();
        resetForm();
      }, 1500);
    },
    onError: (err: any) => {
      setErrorMessage(err.message || 'Import failed. Please check your file.');
    },
  });

  const resetForm = () => {
    setTitle('');
    setAuthor('');
    setRawContent('');
    setFileName(null);
    setErrorMessage(null);
    setSuccessNotice(null);
    setVisibility('all_members');
    setAllowedMemberIds([]);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMessage(null);
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    if (!title) {
      setTitle(file.name.replace(/\.[^/.]+$/, ''));
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setRawContent(content);
    };
    reader.onerror = () => {
      setErrorMessage('Failed to read file from disk.');
    };
    reader.readAsText(file);
  };

  const loadSampleJson = (format: 'issue_export' | 'message_export') => {
    if (format === 'issue_export') {
      const sample = {
        format: 'issue_export',
        project_title: 'Battery Telemetry Deployment',
        export_date: new Date().toISOString().split('T')[0],
        issues: [
          {
            id: 'ISSUE-401',
            title: 'Inverter Thermal Throttle Failure',
            description: 'Thermal sensor reports 48C at high solar noon, causing inverter to drop offline.',
            author: 'Alex Mercer',
            status: 'investigating',
          },
          {
            id: 'ISSUE-402',
            title: 'Cellular Sync SQLite Buffer',
            description: 'Elena assigned database maintenance to Maya Patel for the SQLite backup buffer.',
            author: 'Elena Rostova',
            status: 'assigned',
          },
        ],
      };
      setRawContent(JSON.stringify(sample, null, 2));
      setTitle('Jira Battery Issues Export');
      setAuthor('Issue Tracker Bot');
      setSourceType('json_export');
    } else {
      const sample = {
        format: 'message_export',
        channel: '#telemetry-ops',
        export_date: new Date().toISOString().split('T')[0],
        messages: [
          {
            sender: 'Alex Mercer',
            text: 'I am wrapping up the MQTT backpressure buffer implementation.',
            timestamp: '10:15 AM',
          },
          {
            sender: 'Maya Patel',
            text: 'I will take over system maintenance of the telemetry parser as assigned by Elena in ticket SEC-402.',
            timestamp: '10:20 AM',
          },
        ],
      };
      setRawContent(JSON.stringify(sample, null, 2));
      setTitle('Slack Ops Channel Export');
      setAuthor('Slack Export');
      setSourceType('json_export');
    }
  };

  const toggleMemberAccess = (memberId: string) => {
    if (allowedMemberIds.includes(memberId)) {
      setAllowedMemberIds(allowedMemberIds.filter(id => id !== memberId));
    } else {
      setAllowedMemberIds([...allowedMemberIds, memberId]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!title.trim()) {
      setErrorMessage('Title is required.');
      return;
    }
    if (!author.trim()) {
      setErrorMessage('Author / origin is required.');
      return;
    }
    if (!rawContent.trim()) {
      setErrorMessage('Source content cannot be empty.');
      return;
    }

    importMutation.mutate({
      title: title.trim(),
      author: author.trim(),
      source_type: sourceType,
      raw_content: rawContent.trim(),
      clearance_level: clearanceLevel,
      visibility,
      allowed_member_ids: visibility === 'restricted_members' ? allowedMemberIds : [],
    });
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto animate-in fade-in"
    >
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 my-8 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-600 flex items-center justify-center text-white">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <h2 id="import-modal-title" className="font-bold text-base sm:text-lg text-slate-900 dark:text-white">
                Import Authorised Project Knowledge Source
              </h2>
              <p className="text-xs text-slate-500">
                Supports pasted text, Markdown files (.md), and structured JSON exports.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Close import dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Status alerts */}
          {errorMessage && (
            <div
              role="alert"
              className="p-3.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs sm:text-sm flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successNotice && (
            <div
              role="status"
              className="p-3.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs sm:text-sm flex items-start gap-2"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{successNotice}</span>
            </div>
          )}

          {/* Source Type Selector */}
          <div className="space-y-1.5">
            <label className="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300">
              Input Format & Source Type
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setSourceType('pasted_text')}
                className={`flex flex-col items-center justify-center p-3 rounded-lg border text-xs font-semibold min-h-[44px] transition ${
                  sourceType === 'pasted_text'
                    ? 'border-sky-600 bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <Clipboard className="w-4 h-4 mb-1" />
                <span>Pasted Text</span>
              </button>

              <button
                type="button"
                onClick={() => setSourceType('markdown')}
                className={`flex flex-col items-center justify-center p-3 rounded-lg border text-xs font-semibold min-h-[44px] transition ${
                  sourceType === 'markdown'
                    ? 'border-sky-600 bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <FileText className="w-4 h-4 mb-1" />
                <span>Markdown (.md)</span>
              </button>

              <button
                type="button"
                onClick={() => setSourceType('json_export')}
                className={`flex flex-col items-center justify-center p-3 rounded-lg border text-xs font-semibold min-h-[44px] transition ${
                  sourceType === 'json_export'
                    ? 'border-sky-600 bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <FileCode className="w-4 h-4 mb-1" />
                <span>JSON Export</span>
              </button>
            </div>
          </div>

          {/* File Upload Trigger if Markdown or JSON */}
          {(sourceType === 'markdown' || sourceType === 'json_export') && (
            <div className="space-y-2 p-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 text-center">
              <input
                id="file-upload-input"
                type="file"
                accept={sourceType === 'markdown' ? '.md,.markdown,.txt' : '.json'}
                onChange={handleFileUpload}
                className="hidden"
              />
              <label
                htmlFor="file-upload-input"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 cursor-pointer min-h-[44px]"
              >
                <Upload className="w-4 h-4" />
                <span>Choose {sourceType === 'markdown' ? 'Markdown (.md)' : 'JSON Export (.json)'} File</span>
              </label>
              {fileName && (
                <p className="text-xs text-emerald-600 font-medium">Selected: {fileName}</p>
              )}
              {sourceType === 'json_export' && (
                <div className="pt-2 flex items-center justify-center gap-2 text-xs">
                  <span className="text-slate-400">Or insert sample:</span>
                  <button
                    type="button"
                    onClick={() => loadSampleJson('issue_export')}
                    className="text-sky-600 hover:underline min-h-[36px]"
                  >
                    Issue Export
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={() => loadSampleJson('message_export')}
                    className="text-sky-600 hover:underline min-h-[36px]"
                  >
                    Message Export
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Title & Author Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="import-title" className="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300">
                Document / Source Title
              </label>
              <input
                id="import-title"
                type="text"
                required
                placeholder="e.g. Inverter Maintenance Runbook"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm min-h-[44px] focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="import-author" className="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300">
                Author / Document Origin
              </label>
              <input
                id="import-author"
                type="text"
                required
                placeholder="e.g. Alex Mercer"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm min-h-[44px] focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>

          {/* Raw Content Textarea */}
          <div className="space-y-1.5">
            <label htmlFor="import-content" className="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300">
              Source Content Text (Exact character offsets will be indexed)
            </label>
            <textarea
              id="import-content"
              rows={4}
              required
              placeholder="Paste or edit source content..."
              value={rawContent}
              onChange={(e) => setRawContent(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm min-h-[44px] font-mono text-xs focus:ring-2 focus:ring-sky-500"
            />
          </div>

          {/* Visibility & Clearance Settings (Non-negotiable requirement: uploader sets visibility) */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-3">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-slate-600 dark:text-slate-400" />
              <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                Access Visibility Controls
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="import-visibility" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Who can see this source?
                </label>
                <select
                  id="import-visibility"
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value as SourceVisibility)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm min-h-[44px]"
                >
                  <option value="all_members">All Project Members</option>
                  <option value="restricted_members">Restricted (Select Project Members)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="import-clearance" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Clearance Level (Rule 1 Enforced)
                </label>
                <select
                  id="import-clearance"
                  value={clearanceLevel}
                  onChange={(e) => setClearanceLevel(e.target.value as ClearanceLevel)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm min-h-[44px]"
                >
                  <option value="public">Public</option>
                  <option value="internal">Internal</option>
                  <option value="confidential">Confidential</option>
                  <option value="restricted">Restricted</option>
                </select>
              </div>
            </div>

            {/* Member Checkboxes if Restricted */}
            {visibility === 'restricted_members' && (
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 font-semibold">
                  <Users className="w-3.5 h-3.5" />
                  <span>Choose Authorized Members for this Source:</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto">
                  {projectMembers.map((m) => {
                    const isChecked = allowedMemberIds.includes(m.user.id);
                    return (
                      <label
                        key={m.user.id}
                        className={`flex items-center gap-2.5 p-2 rounded-lg border text-xs cursor-pointer min-h-[44px] ${
                          isChecked
                            ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/60 font-semibold text-sky-900 dark:text-sky-200'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleMemberAccess(m.user.id)}
                          className="w-4 h-4 text-sky-600 rounded focus:ring-sky-500"
                        />
                        <span>{m.user.name} ({m.role})</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-semibold min-h-[44px]"
            >
              Cancel
            </button>
            <button
              id="submit-source-import-btn"
              type="submit"
              disabled={importMutation.isPending}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-bold text-sm min-h-[44px] transition shadow-sm"
            >
              {importMutation.isPending ? 'Processing & Chunking...' : 'Import & Index Source'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

