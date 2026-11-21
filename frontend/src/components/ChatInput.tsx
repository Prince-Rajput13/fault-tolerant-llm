import React, { useRef, useEffect } from 'react';
import { Send, Loader2 } from 'lucide-react';

interface ChatInputProps {
  input: string;
  setInput: (value: string) => void;
  onSend: () => void;
  isLoading: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  input,
  setInput,
  onSend,
  isLoading,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [input]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading) {
        onSend();
      }
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 pb-4">
      <div className="relative rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-lg focus-within:ring-2 focus-within:ring-emerald-500/30 focus-within:border-emerald-500 transition-all p-2 sm:p-2.5">
        <textarea
          ref={textareaRef}
          data-testid="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question... (Enter to send, Shift+Enter for newline)"
          rows={1}
          disabled={isLoading}
          className="w-full resize-none bg-transparent px-3 py-2 text-sm sm:text-base outline-none text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 max-h-[180px] leading-relaxed disabled:opacity-60"
        />

        <div className="flex items-center justify-between pt-1.5 px-2 text-xs text-slate-400">
          <div className="hidden sm:flex items-center gap-1.5 font-medium">
            <span>Press</span>
            <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] text-slate-600 dark:text-slate-300">
              Enter ↵
            </kbd>
            <span>to send</span>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {input.length > 0 && (
              <span className={`text-[11px] font-mono ${input.length > 4000 ? 'text-rose-500 font-bold' : 'text-slate-400'}`}>
                {input.length}/4000
              </span>
            )}
            <button
              data-testid="send-button"
              onClick={onSend}
              disabled={isLoading}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 disabled:opacity-40 disabled:hover:bg-emerald-600 disabled:active:scale-100 text-white font-medium text-sm transition-all shadow-sm"
              title="Send message"
              aria-label="Send message"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="hidden sm:inline">Sending</span>
                </>
              ) : (
                <>
                  <span className="hidden sm:inline">Send</span>
                  <Send className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
