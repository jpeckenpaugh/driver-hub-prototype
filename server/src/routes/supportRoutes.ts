import { Router } from 'express';
import {
  SUPPORT_TOPICS,
  SupportAudience,
  SupportChatMessage,
  SupportEscalationRequest,
  SupportTopic,
} from '@driver-hub/shared';
import { generateSupportReply, getOpenCodeStatus } from '../services/opencodeSupport.js';
import { createSupportTicket } from '../services/supportTickets.js';

const MAX_MESSAGES = 20;
const MAX_MESSAGE_LENGTH = 2000;
const MAX_TRANSCRIPT_LENGTH = 12_000;

function parseAudience(value: unknown): SupportAudience {
  return value === 'driver' ? 'driver' : 'rider';
}

function parseMessages(value: unknown): SupportChatMessage[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('messages must be a non-empty array');
  }
  if (value.length > MAX_MESSAGES) {
    throw new Error(`messages cannot contain more than ${MAX_MESSAGES} items`);
  }

  let totalLength = 0;
  const messages = value.map((entry) => {
    if (!entry || typeof entry !== 'object') {
      throw new Error('each message must be an object');
    }
    const { role, content } = entry as Record<string, unknown>;
    if (role !== 'user' && role !== 'assistant') {
      throw new Error('message role must be user or assistant');
    }
    if (typeof content !== 'string' || !content.trim()) {
      throw new Error('message content must be a non-empty string');
    }
    if (content.length > MAX_MESSAGE_LENGTH) {
      throw new Error(`message content cannot exceed ${MAX_MESSAGE_LENGTH} characters`);
    }
    totalLength += content.length;
    return { role, content: content.trim() } satisfies SupportChatMessage;
  });

  if (totalLength > MAX_TRANSCRIPT_LENGTH) {
    throw new Error('conversation is too long');
  }

  return messages;
}

function parseTopic(value: unknown): SupportTopic {
  if (typeof value === 'string' && (SUPPORT_TOPICS as readonly string[]).includes(value)) {
    return value as SupportTopic;
  }
  return 'other';
}

function parseEscalation(body: unknown): SupportEscalationRequest {
  if (!body || typeof body !== 'object') {
    throw new Error('invalid request body');
  }

  const input = body as Record<string, unknown>;
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const email = typeof input.email === 'string' ? input.email.trim() : '';
  const message = typeof input.message === 'string' ? input.message.trim() : '';

  if (name.length < 2 || name.length > 80) {
    throw new Error('name must be between 2 and 80 characters');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 160) {
    throw new Error('a valid email is required');
  }
  if (message.length < 5 || message.length > 4000) {
    throw new Error('message must be between 5 and 4000 characters');
  }

  let transcript: SupportChatMessage[] | undefined;
  if (input.transcript !== undefined) {
    transcript = parseMessages(input.transcript);
  }

  return {
    name,
    email,
    topic: parseTopic(input.topic),
    message,
    audience: parseAudience(input.audience),
    transcript,
  };
}

export const supportRouter = Router();

supportRouter.get('/status', (_req, res) => {
  res.json(getOpenCodeStatus());
});

supportRouter.post('/chat', async (req, res) => {
  try {
    const messages = parseMessages(req.body?.messages);
    const audience = parseAudience(req.body?.audience);
    const reply = await generateSupportReply(messages, audience);
    res.json(reply);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected support error';
    const status = /messages|content|conversation/.test(message) ? 400 : 500;
    res.status(status).json({ error: message });
  }
});

supportRouter.post('/escalate', (req, res) => {
  try {
    const input = parseEscalation(req.body);
    const ticket = createSupportTicket(input);
    res.status(201).json(ticket);
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : 'Invalid escalation request',
    });
  }
});
