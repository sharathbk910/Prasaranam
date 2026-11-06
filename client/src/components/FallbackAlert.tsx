import React from 'react';
import { Cpu } from 'lucide-react';

export const FallbackAlert: React.FC<{ isFallback: boolean; className?: string }> = ({
  isFallback,
  className = '',
}) => {
  if (!isFallback) return null;

  return (
    <div
      role="alert"
      className={`p-4 rounded-lg border-2 border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 shadow-sm ${className}`}
    >
      <div className="flex items-start gap-3">
        <Cpu className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm tracking-wide uppercase px-2 py-0.5 rounded bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100">
              NON-AI DETERMINISTIC FALLBACK (NOT A LIVE AI RESULT)
            </span>
          </div>
          <p className="text-xs sm:text-sm text-amber-800 dark:text-amber-300">
            This handover record was generated using the deterministic rule-based extractor, not live Gemini AI.
            All statements have been matched against authorized source passages.
          </p>
        </div>
      </div>
    </div>
  );
};
