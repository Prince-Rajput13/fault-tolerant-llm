import { useState, useEffect, useCallback } from 'react';
import { MessageItem, SimulationMode } from '../types';
import { sendChatMessage, getHealth, ApiError } from '../services/api';

function generateSessionId(): string {
  const rand = Math.random().toString(36).substring(2, 10);
  return `s-${rand}`;
}

export function useChat() {
  const [sessionId, setSessionId] = useState<string>(() => generateSessionId());
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [input, setInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [simulationMode, setSimulationMode] = useState<SimulationMode>('');
  const [systemPrompt, setSystemPrompt] = useState<string>('');
  const [isBackendHealthy, setIsBackendHealthy] = useState<boolean | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'info' | 'success' | 'warning' } | null>(null);

  // Check backend health on mount
  useEffect(() => {
    let mounted = true;
    getHealth()
      .then(() => {
        if (mounted) setIsBackendHealthy(true);
      })
      .catch(() => {
        if (mounted) setIsBackendHealthy(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Start fresh chat session
  const startNewChat = useCallback(() => {
    setSessionId(generateSessionId());
    setMessages([]);
    setInput('');
    setIsLoading(false);
    setToast({
      message: 'Started new conversation session.',
      type: 'info',
    });
  }, []);

  // Send message
  const sendMessage = useCallback(
    async (textToSend?: string) => {
      const text = textToSend !== undefined ? textToSend : input;

      // Always clear input field after sending
      setInput('');

      // Add user message to conversation list if not empty, or display attempt
      const userMsg: MessageItem = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: text || '(empty message)',
      };

      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);

      try {
        const response = await sendChatMessage(
          sessionId,
          text,
          systemPrompt || undefined,
          simulationMode
        );

        const assistantMsg: MessageItem = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: response.reply,
          metadata: response.metadata,
        };

        setMessages((prev) => [...prev, assistantMsg]);

        // If fallback occurred, surface friendly toast
        if (response.metadata.fallback_attempts > 0) {
          const attempts = response.metadata.fallback_attempts;
          const key = response.metadata.key_id || 'fallback key';
          setToast({
            message: `Recovered via ${key} after ${attempts} failed attempt${attempts > 1 ? 's' : ''}.`,
            type: 'warning',
          });
        }
      } catch (err: any) {
        let statusCode = 500;
        let errorMessage = 'An unexpected error occurred.';

        if (err instanceof ApiError) {
          statusCode = err.statusCode;
          errorMessage = err.message;
        } else if (err.message) {
          errorMessage = err.message;
        }

        // Add error card - NEVER an assistant message
        const errorMsg: MessageItem = {
          id: `error-${Date.now()}`,
          role: 'error',
          content: errorMessage,
          statusCode,
        };

        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setIsLoading(false);
      }
    },
    [input, sessionId, systemPrompt, simulationMode]
  );

  return {
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
  };
}
