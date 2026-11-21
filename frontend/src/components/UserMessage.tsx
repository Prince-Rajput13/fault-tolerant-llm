import React from 'react';
import { User } from 'lucide-react';

interface UserMessageProps {
  content: string;
}

export const UserMessage: React.FC<UserMessageProps> = ({ content }) => {
  return (
    <div className="flex w-full justify-end my-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
      <div className="flex items-start gap-2.5 max-w-[85%] sm:max-w-[75%]">
        <div className="rounded-2xl px-4 py-3 bg-slate-900 text-white dark:bg-emerald-600 dark:text-white shadow-sm">
          <p className="text-sm sm:text-base leading-relaxed whitespace-pre-wrap break-words">{content}</p>
        </div>
        <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
          <User className="w-4 h-4" />
        </div>
      </div>
    </div>
  );
};
