export type SupportRole = 'user' | 'assistant';

export type SupportAudience = 'rider' | 'driver';

export interface SupportChatMessage {
  role: SupportRole;
  content: string;
}

export interface SupportChatRequest {
  messages: SupportChatMessage[];
  audience?: SupportAudience;
}

export type SupportProvider = 'opencode' | 'demo-fallback';

export interface SupportChatResponse {
  reply: string;
  provider: SupportProvider;
  model: string;
  escalationSuggested: boolean;
}

export const SUPPORT_TOPICS = [
  'account',
  'ride',
  'payment',
  'safety',
  'lost_item',
  'other',
] as const;

export type SupportTopic = typeof SUPPORT_TOPICS[number];

export interface SupportEscalationRequest {
  name: string;
  email: string;
  topic: SupportTopic;
  message: string;
  audience?: SupportAudience;
  transcript?: SupportChatMessage[];
}

export type SupportTicketStatus = 'queued';

export interface SupportEscalationResponse {
  ticketId: string;
  status: SupportTicketStatus;
  createdAt: number;
  estimatedResponseMinutes: number;
  delivery: 'server' | 'local-demo';
}

export interface SupportTicket extends Omit<SupportEscalationResponse, 'delivery'> {
  name: string;
  email: string;
  topic: SupportTopic;
  message: string;
  audience: SupportAudience;
  transcript: SupportChatMessage[];
}
