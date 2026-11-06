import React from 'react';
import { VerificationStatus, ClearanceLevel, HandoverStatus, KnowledgeItemType } from '@prasaranam/shared';
import {
  CheckCircle2,
  ShieldAlert,
  AlertTriangle,
  HelpCircle,
  XCircle,
  ShieldCheck,
  Lock,
  GitCommit,
  CheckSquare,
  OctagonAlert,
  Flame,
  Network,
  HelpCircle as QuestionIcon,
  UserCheck,
} from 'lucide-react';

export const ItemTypeBadge: React.FC<{ type?: KnowledgeItemType; className?: string }> = ({
  type = 'decision',
  className = '',
}) => {
  switch (type) {
    case 'decision':
      return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 ${className}`}>
          <GitCommit className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
          <span>Decision</span>
        </span>
      );
    case 'task':
      return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 border border-sky-200 dark:border-sky-800 ${className}`}>
          <CheckSquare className="w-3 h-3 text-sky-600 dark:text-sky-400" />
          <span>Task</span>
        </span>
      );
    case 'blocker':
      return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-800 ${className}`}>
          <OctagonAlert className="w-3 h-3 text-rose-600 dark:text-rose-400" />
          <span>Blocker</span>
        </span>
      );
    case 'risk':
      return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800 ${className}`}>
          <Flame className="w-3 h-3 text-amber-600 dark:text-amber-400" />
          <span>Risk</span>
        </span>
      );
    case 'dependency':
      return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-200 dark:border-purple-800 ${className}`}>
          <Network className="w-3 h-3 text-purple-600 dark:text-purple-400" />
          <span>Dependency</span>
        </span>
      );
    case 'open_question':
      return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800 ${className}`}>
          <QuestionIcon className="w-3 h-3 text-blue-600 dark:text-blue-400" />
          <span>Open Question</span>
        </span>
      );
    case 'owner_assignment':
      return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 ${className}`}>
          <UserCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
          <span>Assignment</span>
        </span>
      );
    default:
      return null;
  }
};

export const VerificationBadge: React.FC<{ status: VerificationStatus; className?: string }> = ({
  status,
  className = '',
}) => {
  switch (status) {
    case 'supported':
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 ${className}`}
          role="status"
          aria-label={`Verification Status: Supported`}
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
          <span>Supported</span>
        </span>
      );
    case 'corroborated':
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300 border border-teal-300 dark:border-teal-800 ${className}`}
          role="status"
          aria-label={`Verification Status: Corroborated`}
        >
          <ShieldCheck className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" aria-hidden="true" />
          <span>Corroborated</span>
        </span>
      );
    case 'needs confirmation':
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800 ${className}`}
          role="status"
          aria-label={`Verification Status: Needs Confirmation`}
        >
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" aria-hidden="true" />
          <span>Needs Confirmation</span>
        </span>
      );
    case 'conflicting':
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-800 ${className}`}
          role="status"
          aria-label={`Verification Status: Conflicting`}
        >
          <XCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" aria-hidden="true" />
          <span>Conflicting</span>
        </span>
      );
    case 'unknown':
    default:
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700 ${className}`}
          role="status"
          aria-label={`Verification Status: Unknown`}
        >
          <HelpCircle className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 shrink-0" aria-hidden="true" />
          <span>Unknown</span>
        </span>
      );
  }
};

export const ClearanceBadge: React.FC<{ level: ClearanceLevel; className?: string }> = ({
  level,
  className = '',
}) => {
  switch (level) {
    case 'restricted':
      return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-bold bg-purple-100 text-purple-900 dark:bg-purple-950 dark:text-purple-200 border border-purple-300 dark:border-purple-800 ${className}`}>
          <Lock className="w-3 h-3 text-purple-600 dark:text-purple-400" aria-hidden="true" />
          <span>Restricted</span>
        </span>
      );
    case 'confidential':
      return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-bold bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200 border border-red-300 dark:border-red-800 ${className}`}>
          <ShieldAlert className="w-3 h-3 text-red-600 dark:text-red-400" aria-hidden="true" />
          <span>Confidential</span>
        </span>
      );
    case 'internal':
      return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200 border border-blue-300 dark:border-blue-800 ${className}`}>
          <span>Internal</span>
        </span>
      );
    case 'public':
    default:
      return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 ${className}`}>
          <span>Public</span>
        </span>
      );
  }
};

export const HandoverStatusBadge: React.FC<{ status: HandoverStatus }> = ({ status }) => {
  switch (status) {
    case 'approved':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
          <span>Approved</span>
        </span>
      );
    case 'shared':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 border border-sky-300 dark:border-sky-700">
          <ShieldCheck className="w-3.5 h-3.5 text-sky-600" aria-hidden="true" />
          <span>Shared with Recipient</span>
        </span>
      );
    case 'changes_requested':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300 dark:border-rose-700">
          <AlertTriangle className="w-3.5 h-3.5 text-rose-600" aria-hidden="true" />
          <span>Changes Requested</span>
        </span>
      );
    case 'under_review':
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" aria-hidden="true" />
          <span>Under Review</span>
        </span>
      );
  }
};

