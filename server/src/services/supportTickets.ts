import {
  SupportAudience,
  SupportChatMessage,
  SupportEscalationRequest,
  SupportEscalationResponse,
  SupportTicket,
} from '@driver-hub/shared';

const tickets = new Map<string, SupportTicket>();

function createTicketId(): string {
  const time = Date.now().toString(36).toUpperCase().slice(-5);
  const random = Math.random().toString(36).toUpperCase().slice(2, 5);
  return `SUP-${time}${random}`;
}

export function createSupportTicket(
  input: SupportEscalationRequest,
): SupportEscalationResponse {
  let ticketId = createTicketId();
  while (tickets.has(ticketId)) {
    ticketId = createTicketId();
  }

  const createdAt = Date.now();
  const ticket: SupportTicket = {
    ticketId,
    status: 'queued',
    createdAt,
    estimatedResponseMinutes: 15,
    name: input.name.trim(),
    email: input.email.trim(),
    topic: input.topic,
    message: input.message.trim(),
    audience: input.audience || 'rider',
    transcript: (input.transcript || []).slice(-20),
  };

  tickets.set(ticketId, ticket);

  return {
    ticketId,
    status: ticket.status,
    createdAt,
    estimatedResponseMinutes: ticket.estimatedResponseMinutes,
    delivery: 'server',
  };
}

export function getSupportTicket(ticketId: string): SupportTicket | undefined {
  return tickets.get(ticketId);
}

export function getAllSupportTickets(): SupportTicket[] {
  return [...tickets.values()].sort((a, b) => b.createdAt - a.createdAt);
}

export function resetSupportTickets(): void {
  tickets.clear();
}

export type { SupportChatMessage, SupportAudience };
