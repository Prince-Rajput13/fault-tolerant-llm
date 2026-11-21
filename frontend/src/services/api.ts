import { ChatResponse, HealthStatus, SimulationMode } from '../types';

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/+$/, '');

export class ApiError extends Error {
  statusCode: number;
  detail: any;

  constructor(statusCode: number, message: string, detail?: any) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.detail = detail;
  }
}

export async function sendChatMessage(
  sessionId: string,
  message: string,
  systemPrompt?: string,
  simulationMode?: SimulationMode
): Promise<ChatResponse> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (simulationMode && simulationMode.trim() !== '') {
    headers['X-Simulate-Failure'] = simulationMode;
  }

  const payload: { session_id: string; message: string; system_prompt?: string } = {
    session_id: sessionId,
    message,
  };

  if (systemPrompt && systemPrompt.trim() !== '') {
    payload.system_prompt = systemPrompt.trim();
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
  } catch (err: any) {
    throw new ApiError(0, `Network error: Could not reach backend server at ${API_BASE_URL}. Ensure the service is running.`);
  }

  if (response.ok) {
    return await response.json();
  }

  let errorBody: any = null;
  try {
    errorBody = await response.json();
  } catch {
    // Non-JSON response
  }

  if (response.status === 422) {
    let msg = 'Invalid message payload (validation error).';
    if (errorBody && errorBody.detail) {
      if (typeof errorBody.detail === 'string') {
        msg = errorBody.detail;
      } else if (Array.isArray(errorBody.detail)) {
        msg = errorBody.detail.map((d: any) => d.msg || JSON.stringify(d)).join(', ');
      }
    }
    throw new ApiError(422, msg, errorBody);
  }

  if (response.status === 503) {
    throw new ApiError(503, 'All providers are currently unavailable, please try again.', errorBody);
  }

  throw new ApiError(
    response.status,
    (errorBody && errorBody.detail) || `Unexpected server error (${response.status})`,
    errorBody
  );
}

export async function getHealth(): Promise<HealthStatus> {
  try {
    const res = await fetch(`${API_BASE_URL}/health`);
    if (!res.ok) throw new Error(`Health check failed with status ${res.status}`);
    return await res.json();
  } catch (err: any) {
    throw new ApiError(0, err.message || 'Health check unreachable');
  }
}
