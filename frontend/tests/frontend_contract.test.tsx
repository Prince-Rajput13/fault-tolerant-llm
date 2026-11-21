import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import App from '../src/App';
import * as api from '../src/services/api';

describe('Frontend Contract & Requirements Verification', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(api, 'getHealth').mockResolvedValue({
      status: 'ok',
      keys_configured: 2,
      cache_enabled: true,
    });
  });

  it('renders initial inputs with required data-testid attributes', async () => {
    render(<App />);

    // 1. chat-input must exist
    const chatInput = screen.getByTestId('chat-input');
    expect(chatInput).toBeInTheDocument();
    expect(chatInput).toHaveValue('');

    // 2. send-button must exist
    const sendButton = screen.getByTestId('send-button');
    expect(sendButton).toBeInTheDocument();

    // 3. system-prompt-input must exist (open demo tools drawer if needed)
    const demoToolsBtn = screen.getByRole('button', { name: /demo tools/i });
    fireEvent.click(demoToolsBtn);

    const systemPromptInput = await screen.findByTestId('system-prompt-input');
    expect(systemPromptInput).toBeInTheDocument();
  });

  it('clears chat-input after sending and renders assistant-message with all meta elements', async () => {
    vi.spyOn(api, 'sendChatMessage').mockResolvedValueOnce({
      session_id: 's-test1',
      reply: 'The capital of France is Paris.',
      metadata: {
        resolution_source: 'LIVE_INFERENCE',
        model: 'gemini/gemini-2.5-flash',
        latency_ms: 450,
        input_tokens: 38,
        output_tokens: 8,
        key_id: 'key_1',
        fallback_attempts: 0,
      },
    });

    render(<App />);
    const chatInput = screen.getByTestId('chat-input');
    const sendButton = screen.getByTestId('send-button');

    fireEvent.change(chatInput, { target: { value: 'What is the capital of France?' } });
    expect(chatInput).toHaveValue('What is the capital of France?');

    fireEvent.click(sendButton);

    // chat-input must be empty after sending
    expect(chatInput).toHaveValue('');

    // Wait for assistant reply container
    const assistantMsg = await screen.findByTestId('assistant-message');
    expect(assistantMsg).toBeInTheDocument();
    expect(assistantMsg).toHaveTextContent('The capital of France is Paris.');

    // Contract testids inside assistant-message:
    const metaSource = screen.getByTestId('meta-source');
    expect(metaSource.textContent?.trim()).toBe('LIVE_INFERENCE');

    const metaModel = screen.getByTestId('meta-model');
    expect(metaModel.textContent?.trim()).toBe('gemini/gemini-2.5-flash');

    const metaLatency = screen.getByTestId('meta-latency');
    expect(metaLatency.textContent?.trim()).toBe('450 ms');

    const metaInputTokens = screen.getByTestId('meta-input-tokens');
    expect(metaInputTokens.textContent?.trim()).toBe('38');

    const metaOutputTokens = screen.getByTestId('meta-output-tokens');
    expect(metaOutputTokens.textContent?.trim()).toBe('8');
  });

  it('renders LLM_CACHE correctly when cached response is returned', async () => {
    vi.spyOn(api, 'sendChatMessage').mockResolvedValueOnce({
      session_id: 's-cache-test',
      reply: 'The capital of France is Paris.',
      metadata: {
        resolution_source: 'LLM_CACHE',
        model: 'gemini/gemini-2.5-flash',
        latency_ms: 12,
        input_tokens: 38,
        output_tokens: 8,
        key_id: null,
        fallback_attempts: 0,
      },
    });

    render(<App />);
    const chatInput = screen.getByTestId('chat-input');
    const sendButton = screen.getByTestId('send-button');

    fireEvent.change(chatInput, { target: { value: 'What is the capital of France?' } });
    fireEvent.click(sendButton);

    const metaSource = await screen.findByTestId('meta-source');
    expect(metaSource.textContent?.trim()).toBe('LLM_CACHE');
  });

  it('renders 503 error as readable alert without creating an assistant-message', async () => {
    vi.spyOn(api, 'sendChatMessage').mockRejectedValueOnce(
      new api.ApiError(503, 'All providers are currently unavailable, please try again.')
    );

    render(<App />);
    const chatInput = screen.getByTestId('chat-input');
    const sendButton = screen.getByTestId('send-button');

    fireEvent.change(chatInput, { target: { value: 'Trigger 503 outage' } });
    fireEvent.click(sendButton);

    // Error alert text appears
    const errorAlert = await screen.findByText('All providers are currently unavailable, please try again.');
    expect(errorAlert).toBeInTheDocument();

    // Crucial requirement: A failed request must NOT appear as an assistant reply
    expect(screen.queryByTestId('assistant-message')).not.toBeInTheDocument();
  });

  it('renders 422 validation error inline without creating an assistant-message', async () => {
    vi.spyOn(api, 'sendChatMessage').mockRejectedValueOnce(
      new api.ApiError(422, 'message must not be blank after trimming whitespace')
    );

    render(<App />);
    const chatInput = screen.getByTestId('chat-input');
    const sendButton = screen.getByTestId('send-button');

    fireEvent.change(chatInput, { target: { value: '   ' } });
    fireEvent.click(sendButton);

    const errorAlert = await screen.findByText(/message must not be blank/i);
    expect(errorAlert).toBeInTheDocument();

    // No assistant message container
    expect(screen.queryByTestId('assistant-message')).not.toBeInTheDocument();
  });
});
