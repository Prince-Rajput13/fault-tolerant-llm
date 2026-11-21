import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Bot, Check, Copy, Zap, Database, ArrowRightLeft, Cpu } from 'lucide-react';
import { ChatMetadata } from '../types';

interface AssistantMessageProps {
  content: string;
  metadata?: ChatMetadata;
}

export const AssistantMessage: React.FC<AssistantMessageProps> = ({ content, metadata }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const isCache = metadata?.resolution_source === 'LLM_CACHE';

  return (
    <div
      data-testid="assistant-message"
      className="flex w-full justify-start my-3 animate-in fade-in slide-in-from-bottom-2 duration-200"
    >
      <div className="flex items-start gap-2.5 max-w-[92%] sm:max-w-[85%]">
        {/* Avatar */}
        <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
          <Bot className="w-4 h-4" />
        </div>

        {/* Message body + metadata */}
        <div className="flex-1 min-w-0 rounded-2xl p-4 sm:p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm transition-all hover:shadow-md">
          {/* Header row: Resolution badge + Copy button */}
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2.5 border-b border-slate-100 dark:border-slate-800/80 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              {metadata && (
                <span
                  data-testid="meta-source"
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-semibold uppercase tracking-wider text-[11px] shadow-sm ${
                    isCache
                      ? 'bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                      : 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                  }`}
                >
                  {isCache ? <Database className="w-3 h-3 shrink-0" /> : <Zap className="w-3 h-3 shrink-0" />}
                  {metadata.resolution_source}
                </span>
              )}

              {metadata?.key_id && (
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono text-[11px]">
                  <Cpu className="w-3 h-3 text-slate-400" />
                  {metadata.key_id}
                </span>
              )}

              {metadata && metadata.fallback_attempts > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 font-medium text-[11px] border border-amber-200 dark:border-amber-800">
                  <ArrowRightLeft className="w-3 h-3" />
                  Fallback: {metadata.fallback_attempts}
                </span>
              )}
            </div>

            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Copy message"
              aria-label="Copy message"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span className="text-[11px]">{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>

          {/* Markdown Content */}
          <div className="prose prose-slate dark:prose-invert max-w-none text-sm sm:text-base leading-relaxed break-words">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ inline, className, children, ...props }: any) {
                  return inline ? (
                    <code className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 font-mono text-xs" {...props}>
                      {children}
                    </code>
                  ) : (
                    <div className="relative my-2 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-950 text-slate-100">
                      <pre className="p-3 overflow-x-auto text-xs font-mono">
                        <code {...props}>{children}</code>
                      </pre>
                    </div>
                  );
                },
              }}
            >
              {content}
            </ReactMarkdown>
          </div>

          {/* Metadata Footer Bar - strictly satisfies contract */}
          {metadata && (
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-y-2 text-xs text-slate-500 dark:text-slate-400">
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1 font-mono text-slate-600 dark:text-slate-300">
                  <span className="text-slate-400">model:</span>
                  <span data-testid="meta-model">{metadata.model}</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="text-slate-400">latency:</span>
                  <span data-testid="meta-latency" className="font-medium text-slate-700 dark:text-slate-300">
                    {metadata.latency_ms} ms
                  </span>
                </span>
              </div>

              <div className="flex items-center gap-3 font-mono">
                <span className="inline-flex items-center gap-1" title="Input tokens (this request only)">
                  <span className="text-slate-400">in:</span>
                  <span data-testid="meta-input-tokens" className="text-slate-700 dark:text-slate-300 font-semibold">
                    {metadata.input_tokens}
                  </span>
                </span>
                <span className="inline-flex items-center gap-1" title="Output tokens (this request only)">
                  <span className="text-slate-400">out:</span>
                  <span data-testid="meta-output-tokens" className="text-slate-700 dark:text-slate-300 font-semibold">
                    {metadata.output_tokens}
                  </span>
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
