import {
  SupportAudience,
  SupportChatMessage,
  SupportChatResponse,
  SupportEscalationRequest,
  SupportEscalationResponse,
} from '@driver-hub/shared';
import { createLocalTicket, localChatReply } from './supportFallback';

const CHAT_TIMEOUT_MS = 65_000;
const ESCALATION_TIMEOUT_MS = 15_000;

function resolveApiBase(): string {
  const configured = import.meta.env.VITE_SUPPORT_API_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');

  const { hostname } = window.location;
  if (hostname.endsWith('.github.io')) return '';

  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:3001';
  }

  return window.location.origin;
}

const API_BASE = resolveApiBase();

class SupportApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'SupportApiError';
    this.status = status;
  }
}

async function postJson<T>(
  path: string,
  body: unknown,
  timeoutMs: number,
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });

  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON error page */
  }

  if (!response.ok) {
    const message =
      data && typeof data === 'object' && 'error' in data
        ? String((data as { error: unknown }).error)
        : `Support API ${response.status}`;
    throw new SupportApiError(message, response.status);
  }

  return data as T;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function requestSupportChat(
  messages: SupportChatMessage[],
  audience: SupportAudience,
): Promise<SupportChatResponse> {
  if (!API_BASE) {
    await delay(350);
    return localChatReply(messages);
  }

  try {
    const response = await postJson<SupportChatResponse>(
      '/api/support/chat',
      { messages, audience },
      CHAT_TIMEOUT_MS,
    );
    if (!response?.reply) throw new Error('Empty support response');
    return response;
  } catch (error) {
    if (error instanceof SupportApiError && error.status === 400) {
      throw error;
    }
    console.warn('[support] API unavailable, using local demo fallback:', error);
    return localChatReply(messages);
  }
}

export async function submitSupportEscalation(
  input: SupportEscalationRequest & { audience: SupportAudience },
): Promise<SupportEscalationResponse> {
  if (!API_BASE) {
    await delay(450);
    return createLocalTicket(input);
  }

  try {
    return await postJson<SupportEscalationResponse>(
      '/api/support/escalate',
      input,
      ESCALATION_TIMEOUT_MS,
    );
  } catch (error) {
    if (error instanceof SupportApiError && error.status === 400) {
      throw error;
    }
    console.warn('[support] Escalation API unavailable, saving local demo ticket:', error);
    return createLocalTicket(input);
  }
}

export function isSupportApiConfigured(): boolean {
  return Boolean(API_BASE);
}
