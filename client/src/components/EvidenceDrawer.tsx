import React, { useEffect, useRef } from 'react';
import { X, ExternalLink, CheckCircle2, AlertTriangle, FileText, Lock, Calendar, User as UserIcon } from 'lucide-react';
import { QuotationEvidence, Passage } from '@prasaranam/shared';
import { ClearanceBadge } from './Badges.js';

interface EvidenceDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  quotation: QuotationEvidence | null;
  passage?: Passage | null;
  itemTopic?: string;
}

export const EvidenceDrawer: React.FC<EvidenceDrawerProps> = ({
  isOpen,
  onClose,
  quotation,
  passage,
  itemTopic,
}) => {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Rule 14: Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      // Auto focus close button for accessibility
      setTimeout(() => closeButtonRef.current?.focus(), 50);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !quotation) return null;

  const isAccessible = quotation.is_source_accessible !== false;
  const passageText = passage?.text_content || quotation.quote;
  const quote = quotation.quote;
  const isMatch = quotation.exact_match;

  // Highlight the quotation inside the passage
  const highlightPassage = () => {
    if (!quote || !passageText) return passageText;
    const idx = passageText.indexOf(quote);
    if (idx === -1) {
      return (
        <span className="text-slate-700 dark:text-slate-300">
          {passageText}
        </span>
      );
    }
    const before = passageText.substring(0, idx);
    const matched = passageText.substring(idx, idx + quote.length);
    const after = passageText.substring(idx + quote.length);

    return (
      <span className="text-slate-700 dark:text-slate-300 leading-relaxed">
        {before}
        <mark className="bg-yellow-200 dark:bg-yellow-900/60 dark:text-yellow-100 font-medium px-1 rounded border-b-2 border-yellow-500">
          {matched}
        </mark>
        {after}
      </span>
    );
  };

  return (
    <div
      id="evidence-drawer"
      className="fixed inset-0 z-50 overflow-hidden"
      aria-labelledby="evidence-sheet-title"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="fixed inset-0 flex justify-end">
        {/*
          Rule 14:
          Mobile: Full-screen sheet (w-full h-full)
          Desktop (md:): Side slide-over panel (md:max-w-xl md:h-full)
        */}
        <div className="w-full md:max-w-xl h-full bg-white dark:bg-slate-900 shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-200 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-sky-600 dark:text-sky-400 shrink-0" aria-hidden="true" />
              <h2 id="evidence-sheet-title" className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                Source Evidence & Exact Passage
              </h2>
            </div>
            <button
              id="btn-close-evidence"
              ref={closeButtonRef}
              onClick={onClose}
              className="flex items-center justify-center min-h-[44px] min-w-[44px] p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors focus:ring-2 focus:ring-sky-500"
              aria-label="Close evidence panel"
            >
              <X className="w-6 h-6" aria-hidden="true" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
            {/* Topic Reference */}
            {itemTopic && (
              <div>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Handover Statement Topic
                </span>
                <p className="mt-1 font-medium text-slate-900 dark:text-slate-100 text-sm sm:text-base">
                  {itemTopic}
                </p>
              </div>
            )}

            {/* Source Metadata Card (Phase 5 requirement: title, author, date, passage) */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Source Document Title
                  </span>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                    {quotation.source_title}
                  </h3>
                </div>
                {(quotation.source_clearance || passage?.clearance_level) && (
                  <ClearanceBadge level={quotation.source_clearance || passage?.clearance_level || 'internal'} />
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-300 pt-1 border-t border-slate-200 dark:border-slate-700/60">
                <div className="flex items-center gap-1.5">
                  <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                  <span>Author: {quotation.source_author || 'Alex Mercer'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>Date: {quotation.source_date ? new Date(quotation.source_date).toLocaleDateString() : 'October 2026'}</span>
                </div>
              </div>
            </div>

            {/* Inaccessible / Restricted Notice if caller lacks permissions (Phase 5 requirement) */}
            {!isAccessible ? (
              <div className="p-4 rounded-xl border border-rose-300 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 space-y-2">
                <div className="flex items-start gap-2.5">
                  <Lock className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-sm">Access Restricted: Clearance Boundary</h4>
                    <p className="text-xs leading-relaxed text-rose-800 dark:text-rose-300 mt-1">
                      You do not have the required clearance level to inspect this verbatim source passage.
                      The referenced source is restricted by project access control policies.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Quotation Verification Status Box */}
                <div className={`p-4 rounded-lg border ${
                  isMatch
                    ? 'bg-emerald-50 border-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-800'
                    : 'bg-rose-50 border-rose-300 dark:bg-rose-950/40 dark:border-rose-800'
                }`}>
                  <div className="flex items-start gap-3">
                    {isMatch ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" aria-hidden="true" />
                    )}
                    <div>
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                        {isMatch ? 'Exact Substring Verified' : 'Quotation Mismatch / Warning'}
                      </h4>
                      <p className="text-xs sm:text-sm mt-0.5 text-slate-600 dark:text-slate-300">
                        {isMatch
                          ? 'The server verified that this quotation matches the source passage verbatim.'
                          : 'The quotation does not match the source passage text character-for-character.'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Extracted Quotation */}
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Referenced Quotation
                  </span>
                  <blockquote className="p-3.5 rounded-lg bg-sky-50 dark:bg-sky-950/30 border-l-4 border-sky-500 text-slate-800 dark:text-slate-200 text-sm font-medium italic">
                    "{quotation.quote}"
                  </blockquote>
                </div>

                {/* Source Document Context */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Full Source Passage
                    </span>
                    {passage?.clearance_level && (
                      <ClearanceBadge level={passage.clearance_level} />
                    )}
                  </div>

                  <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 font-medium">
                    <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Passage ID: {quotation.passage_id}</span>
                  </div>

                  <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-sm">
                    {highlightPassage()}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Footer action */}
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-end">
            <button
              onClick={onClose}
              className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 font-semibold text-sm text-slate-800 dark:text-slate-100 min-h-[44px] transition-colors"
            >
              Close Evidence
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

