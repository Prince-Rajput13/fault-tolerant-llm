import React, { useState } from 'react';
import {
  Wrench,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Sliders,
  Copy,
  Check,
  ZapOff,
  Flame,
  ShieldAlert,
  Info
} from 'lucide-react';
import { SimulationMode } from '../types';

interface DemoToolsProps {
  sessionId: string;
  onNewChat: () => void;
  simulationMode: SimulationMode;
  setSimulationMode: (mode: SimulationMode) => void;
  systemPrompt: string;
  setSystemPrompt: (prompt: string) => void;
  isBackendHealthy: boolean | null;
}

export const DemoTools: React.FC<DemoToolsProps> = ({
  sessionId,
  onNewChat,
  simulationMode,
  setSimulationMode,
  systemPrompt,
  setSystemPrompt,
  isBackendHealthy,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [copiedSession, setCopiedSession] = useState(false);

  const copySessionId = async () => {
    try {
      await navigator.clipboard.writeText(sessionId);
      setCopiedSession(true);
      setTimeout(() => setCopiedSession(false), 2000);
    } catch {
      // ignore
    }
  };

  const simulationOptions: { label: string; value: SimulationMode; desc: string; icon: any }[] = [
    { label: 'None (Normal)', value: '', desc: 'Standard key rotation and live inference', icon: Sliders },
    { label: 'key_1=429', value: 'key_1=429', desc: 'Simulate Rate Limit on primary key → auto-failover to key_2', icon: ZapOff },
    { label: 'key_1=429,key_2=500', value: 'key_1=429,key_2=500', desc: 'Simulate multi-key failure → returns clean 503', icon: Flame },
    { label: '*=429', value: '*=429', desc: 'Simulate wildcard total outage → returns 503', icon: ShieldAlert },
  ];

  return (
    <div className="w-full border-b border-slate-200/80 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md transition-all">
      <div className="max-w-5xl mx-auto px-4 py-2 flex items-center justify-between gap-3 text-xs">
        {/* Left: Session ID and Health status */}
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="flex items-center gap-1.5 font-mono text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-slate-700 dark:text-slate-200">Session:</span>
            <span className="truncate max-w-[120px] sm:max-w-[200px]" title={sessionId}>
              {sessionId}
            </span>
            <button
              onClick={copySessionId}
              className="p-1 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
              title="Copy session ID"
            >
              {copiedSession ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Health indicator */}
          <div className="hidden sm:flex items-center gap-1.5 pl-2 border-l border-slate-200 dark:border-slate-800">
            <span
              className={`w-2 h-2 rounded-full ${
                isBackendHealthy === true
                  ? 'bg-emerald-500 animate-pulse'
                  : isBackendHealthy === false
                  ? 'bg-rose-500'
                  : 'bg-amber-500'
              }`}
            />
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              {isBackendHealthy === true ? 'Backend Online' : isBackendHealthy === false ? 'Backend Offline' : 'Connecting...'}
            </span>
          </div>

          {/* Active simulation pill indicator */}
          {simulationMode && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 font-mono text-[10px] border border-amber-300 dark:border-amber-800 animate-pulse">
              Sim: {simulationMode}
            </span>
          )}
        </div>

        {/* Right: New Chat and Demo Tools toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={onNewChat}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium transition-colors"
            title="Start new conversation (resets session)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New Chat</span>
          </button>

          <button
            onClick={() => setIsOpen(!isOpen)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors ${
              isOpen || simulationMode
                ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
            }`}
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>Demo Tools</span>
            {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Expanded Demo Tools Drawer */}
      {isOpen && (
        <div className="max-w-5xl mx-auto px-4 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 animate-in slide-in-from-top-2 duration-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Failure Simulation Selector */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-emerald-500" />
                  X-Simulate-Failure Header Hook
                </span>
                <span className="text-[11px] text-slate-400">Section 4 of spec</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Test automatic key rotation and graceful 503 handling on demand without waiting for real rate limits:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {simulationOptions.map((opt) => {
                  const Icon = opt.icon;
                  const isSelected = simulationMode === opt.value;
                  return (
                    <button
                      key={opt.label}
                      onClick={() => setSimulationMode(opt.value)}
                      className={`text-left p-2.5 rounded-xl border text-xs transition-all ${
                        isSelected
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-200 font-medium shadow-sm'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-mono font-semibold">
                        <Icon className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>{opt.label}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                        {opt.desc}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Optional System Prompt Field */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-emerald-500" />
                  Session System Prompt (Optional)
                </span>
                <span className="text-[11px] text-slate-400 font-mono">system_prompt</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Overrides default assistant instructions for this session:
              </p>
              <textarea
                data-testid="system-prompt-input"
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="e.g. You are a concise Unix DevOps engineer. Always reply in bullet points."
                rows={3}
                className="w-full resize-none rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/80 px-3 py-2 text-xs text-slate-800 dark:text-slate-200 outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 placeholder:text-slate-400 leading-relaxed font-sans"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
