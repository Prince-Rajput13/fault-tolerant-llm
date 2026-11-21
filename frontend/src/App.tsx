import { Sun, Moon, Sparkles, Activity } from 'lucide-react';
import { useChat } from './hooks/useChat';
import { useTheme } from './hooks/useTheme';
import { DemoTools } from './components/DemoTools';
import { MessageList } from './components/MessageList';
import { ChatInput } from './components/ChatInput';
import { Toast } from './components/Toast';

export function App() {
  const {
    sessionId,
    messages,
    input,
    setInput,
    isLoading,
    simulationMode,
    setSimulationMode,
    systemPrompt,
    setSystemPrompt,
    isBackendHealthy,
    toast,
    setToast,
    startNewChat,
    sendMessage,
  } = useChat();

  const { theme, toggleTheme } = useTheme();

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* Top Header */}
      <header className="w-full border-b border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md z-20 shrink-0">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-md shadow-emerald-600/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-sm sm:text-base tracking-tight text-slate-900 dark:text-slate-100">
                  Fault-Tolerant LLM Gateway
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                  <Activity className="w-2.5 h-2.5" /> LiteLLM Pool
                </span>
              </div>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 hidden sm:block">
                Auto-failover between provider keys + local response caching
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
            </button>
          </div>
        </div>
      </header>

      {/* Demo Tools Bar */}
      <DemoTools
        sessionId={sessionId}
        onNewChat={startNewChat}
        simulationMode={simulationMode}
        setSimulationMode={setSimulationMode}
        systemPrompt={systemPrompt}
        setSystemPrompt={setSystemPrompt}
        isBackendHealthy={isBackendHealthy}
      />

      {/* Main Chat Feed */}
      <main className="flex-1 overflow-hidden flex flex-col relative">
        <MessageList
          messages={messages}
          isLoading={isLoading}
          onSelectPrompt={(prompt) => sendMessage(prompt)}
          onRetryError={() => {
            // Find last user message and retry
            const lastUser = [...messages].reverse().find((m) => m.role === 'user');
            if (lastUser) sendMessage(lastUser.content);
          }}
        />

        {/* Input Bar */}
        <ChatInput
          input={input}
          setInput={setInput}
          onSend={() => sendMessage()}
          isLoading={isLoading}
        />
      </main>

      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}

export default App;
