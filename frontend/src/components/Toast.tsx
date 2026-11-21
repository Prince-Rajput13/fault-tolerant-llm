import React, { useEffect } from 'react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';

export interface ToastProps {
  message: string;
  type?: 'info' | 'success' | 'warning';
  onClose: () => void;
  duration?: number;
}

export const Toast: React.FC<ToastProps> = ({ message, type = 'info', onClose, duration = 4500 }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);

  const bgClasses = {
    info: 'bg-indigo-900/90 text-indigo-100 border-indigo-700/60 shadow-indigo-900/30',
    success: 'bg-emerald-900/90 text-emerald-100 border-emerald-700/60 shadow-emerald-900/30',
    warning: 'bg-amber-900/90 text-amber-100 border-amber-700/60 shadow-amber-900/30',
  }[type];

  return (
    <div
      role="status"
      className={`fixed bottom-24 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-md shadow-xl text-sm font-medium animate-in fade-in slide-in-from-bottom-4 duration-300 max-w-md ${bgClasses}`}
    >
      {type === 'warning' ? (
        <AlertCircle className="w-5 h-5 text-amber-300 shrink-0" />
      ) : (
        <CheckCircle2 className="w-5 h-5 text-emerald-300 shrink-0" />
      )}
      <span className="flex-1 leading-snug">{message}</span>
      <button
        onClick={onClose}
        className="p-1 rounded-lg hover:bg-white/10 transition-colors text-slate-300 hover:text-white"
        aria-label="Close notification"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
