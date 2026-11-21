import React from 'react';
import { AlertTriangle, ServerCrash, RefreshCw } from 'lucide-react';

interface ErrorCardProps {
  content: string;
  statusCode?: number;
  onRetry?: () => void;
}

export const ErrorCard: React.FC<ErrorCardProps> = ({ content, statusCode, onRetry }) => {
  const is503 = statusCode === 503;
  const is422 = statusCode === 422;

  return (
    <div className="flex w-full justify-start my-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
      <div className="max-w-[85%] sm:max-w-[75%] rounded-2xl p-4 border shadow-sm bg-rose-50/80 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/60 text-rose-900 dark:text-rose-200">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-rose-100 dark:bg-rose-900/60 text-rose-600 dark:text-rose-300 shrink-0 mt-0.5">
            {is503 ? <ServerCrash className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-xs tracking-wider uppercase px-2 py-0.5 rounded-full bg-rose-200/60 dark:bg-rose-900/80 text-rose-800 dark:text-rose-200">
                {is422 ? 'Validation Error (422)' : is503 ? 'Service Unavailable (503)' : `Error (${statusCode || 'Network'})`}
              </span>
            </div>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{content}</p>
            {onRetry && (
              <button
                onClick={onRetry}
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-rose-700 dark:text-rose-300 hover:text-rose-900 dark:hover:text-rose-100 bg-rose-100/80 dark:bg-rose-900/40 hover:bg-rose-200/80 dark:hover:bg-rose-800/50 px-3 py-1.5 rounded-lg transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry Request
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
