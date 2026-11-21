import React, { useEffect, useRef } from 'react';
import { Bot, Sparkles, Zap, ShieldCheck, Database, Terminal } from 'lucide-react';
import { MessageItem } from '../types';
import { AssistantMessage } from './AssistantMessage';
import { UserMessage } from './UserMessage';
import { ErrorCard } from './ErrorCard';

interface MessageListProps {
  messages: MessageItem[];
  isLoading: boolean;
  onSelectPrompt: (prompt: string) => void;
  onRetryError?: () => void;
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  isLoading,
  onSelectPrompt,
  onRetryError,
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const starterPrompts = [
    {
      title: 'What is the capital of France?',
      subtitle: 'Tests deterministic caching & token metrics',
      icon: Sparkles,
      prompt: 'What is the capital of France?',
    },
    {
      title: 'Explain key failover in 2 bullet points',
      subtitle: 'Tests prompt context & markdown formatting',
      icon: ShieldCheck,
      prompt: 'Explain key failover in 2 bullet points.',
    },
    {
      title: 'Write a Python function to compute Fibonacci',
      subtitle: 'Tests code highlighting & copy button',
      icon: Terminal,
      prompt: 'Write a Python function to compute Fibonacci numbers with memoization.',
    },
    {
      title: 'Summarize caching benefits for LLM apps',
      subtitle: 'Tests multi-turn context retention',
      icon: Database,
      prompt: 'Summarize 3 core benefits of caching LLM responses.',
    },
  ];

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-3xl mx-auto my-auto animate-in fade-in duration-300">
        <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20 mb-5">
          <Bot className="w-8 h-8" />
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">
          Fault-Tolerant LLM Gateway
        </h2>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 max-w-md leading-relaxed">
          Powered by FastAPI, LiteLLM key rotation, and SQLite conversation history.
          Every response provides latency and per-request token analytics.
        </p>

        {/* Feature badges */}
        <div className="flex flex-wrap items-center justify-center gap-2 mt-5 text-xs text-slate-600 dark:text-slate-300">
          <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-emerald-500" /> Auto Key Failover
          </span>
          <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-purple-500" /> Response Cache
          </span>
          <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-500" /> SQLite WAL Storage
          </span>
        </div>

        {/* Starter suggestions */}
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3 mt-8 text-left">
          {starterPrompts.map((item, idx) => {
            const Icon = item.icon;
            return (
              <button
                key={idx}
                onClick={() => onSelectPrompt(item.prompt)}
                className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 hover:border-emerald-400 dark:hover:border-emerald-600 hover:shadow-sm transition-all group"
              >
                <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-semibold text-xs sm:text-sm group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                  <Icon className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>{item.title}</span>
                </div>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 pl-6">
                  {item.subtitle}
                </p>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 max-w-4xl w-full mx-auto space-y-4">
      {messages.map((msg) => {
        if (msg.role === 'user') {
          return <UserMessage key={msg.id} content={msg.content} />;
        }
        if (msg.role === 'assistant') {
          return (
            <AssistantMessage
              key={msg.id}
              content={msg.content}
              metadata={msg.metadata}
            />
          );
        }
        if (msg.role === 'error') {
          return (
            <ErrorCard
              key={msg.id}
              content={msg.content}
              statusCode={msg.statusCode}
              onRetry={onRetryError}
            />
          );
        }
        return null;
      })}

      {/* Loading state indicator */}
      {isLoading && (
        <div className="flex w-full justify-start my-3 animate-in fade-in duration-200">
          <div className="flex items-center gap-3 rounded-2xl px-5 py-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm text-slate-500 dark:text-slate-400">
            <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Bot className="w-3.5 h-3.5" />
            </div>
            <div className="flex items-center gap-1.5 text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '300ms' }} />
              <span className="ml-2">Routing through LiteLLM key pool...</span>
            </div>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
};
