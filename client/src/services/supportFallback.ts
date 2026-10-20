import {
  SupportAudience,
  SupportChatMessage,
  SupportChatResponse,
  SupportEscalationRequest,
  SupportEscalationResponse,
} from '@driver-hub/shared';

const ESCALATION_PATTERN =
  /(refund|reembolso|human|persona|representative|representante|agent|agente|complaint|queja|charge|chargeback|cobro|fraud|fraude|account|cuenta|safety|seguridad|accident|accidente|lost|perd[ií]|emergency|emergencia|discriminat|urgent|urgente)/i;

const SPANISH_PATTERN = /[áéíóúñ¿¡]/i;

function isSpanish(text: string): boolean {
  return (
    SPANISH_PATTERN.test(text) ||
    /\b(hola|gracias|viaje|conductor|ayuda|cancelar|cuenta|pago|cobro|perdí|perdi|seguridad|c[oó]mo|d[oó]nde|problema|solicitar)\b/i.test(
      text,
    )
  );
}

export function localChatReply(messages: SupportChatMessage[]): SupportChatResponse {
  const lastUserMessage =
    [...messages].reverse().find((message) => message.role === 'user')?.content || '';
  const lower = lastUserMessage.toLowerCase();
  const spanish = isSpanish(lastUserMessage);
  const escalation = ESCALATION_PATTERN.test(lastUserMessage);

  let reply: string;

  if (/(cancel|cancelar)/i.test(lower)) {
    reply = spanish
      ? 'Puedes cancelar desde el viaje activo: abre el panel del viaje y pulsa "Cancelar". Si ya hay un conductor asignado, puede aplicarse una tarifa de cancelación. Si el botón no aparece, pulsa "Hablar con una persona" y te ayudamos.'
      : 'You can cancel from the active ride: open the trip panel and tap "Cancel". If a driver has already accepted, a cancellation fee may apply. If the button is missing, tap "Talk to a human" and we will help.';
  } else if (/(perd[ií]|lost|objeto|item|olvid)/i.test(lower)) {
    reply = spanish
      ? 'Lo siento. Para un objeto perdido necesitamos revisar el viaje: pulsa "Hablar con una persona" y envía la hora del viaje, la ruta y una descripción del objeto.'
      : 'Sorry about that. For a lost item we need to review the trip: tap "Talk to a human" and send the trip time, route, and a description of the item.';
  } else if (/(pago|cobro|cargo|refund|reembolso|charge|fare|tarifa|precio)/i.test(lower)) {
    reply = spanish
      ? 'La tarifa se muestra antes de solicitar y otra vez durante el viaje. Este prototipo no cobra dinero real. Para disputas de cobro o reembolsos, pulsa "Hablar con una persona" y un representante revisará el caso.'
      : 'The fare is shown before you request and again during the trip. This prototype does not charge real money. For charge disputes or refunds, tap "Talk to a human" so a representative can review the case.';
  } else if (/(seguridad|safety|accidente|accident|emergencia|emergency)/i.test(lower)) {
    reply = spanish
      ? 'Si hay peligro inmediato, contacta primero a los servicios de emergencia locales. Para una preocupación de seguridad no urgente, pulsa "Hablar con una persona" para escalar el caso de inmediato.'
      : 'If there is immediate danger, contact local emergency services first. For a non-emergency safety concern, tap "Talk to a human" to escalate the case right away.';
    return {
      reply,
      provider: 'demo-fallback',
      model: 'local-faq',
      escalationSuggested: true,
    };
  } else if (/(conductor|driver|conduc|recogida|pickup)/i.test(lower)) {
    reply = spanish
      ? 'Puedes seguir al conductor en el mapa. Cuando llegue al punto de recogida verás el aviso "El conductor ha llegado" y podrás contactarlo con los botones Llamar o Mensaje. Si el conductor no llega, pulsa "Hablar con una persona".'
      : 'You can follow the driver on the map. When they reach the pickup point you will see the "driver has arrived" notice and can use the Call or Message buttons. If the driver does not arrive, tap "Talk to a human".';
  } else if (/(cuenta|account|contras|password|login|iniciar sesi)/i.test(lower)) {
    reply = spanish
      ? 'No puedo cambiar datos de tu cuenta desde el chat. Pulsa "Hablar con una persona" y describe qué necesitas actualizar para que un representante lo revise.'
      : 'I cannot change account details from chat. Tap "Talk to a human" and describe what you need updated so a representative can review it.';
    return {
      reply,
      provider: 'demo-fallback',
      model: 'local-faq',
      escalationSuggested: true,
    };
  } else {
    reply = spanish
      ? 'Estoy aquí para ayudarte con viajes, pagos, cuenta y seguridad. Puedo explicarte cómo solicitar o cancelar un viaje, o puedes pulsar "Hablar con una persona" para enviar tu caso a un representante.'
      : 'I can help with rides, payments, account, and safety questions. I can walk you through requesting or cancelling a ride, or you can tap "Talk to a human" to send your case to a representative.';
  }

  return {
    reply,
    provider: 'demo-fallback',
    model: 'local-faq',
    escalationSuggested: escalation,
  };
}

export function createLocalTicket(
  input: SupportEscalationRequest & { audience: SupportAudience },
): SupportEscalationResponse {
  const createdAt = Date.now();
  const ticketId = `DEMO-${createdAt.toString(36).toUpperCase().slice(-6)}`;
  const storageKey = 'driver-hub-support-tickets';

  try {
    const existing = JSON.parse(localStorage.getItem(storageKey) || '[]') as unknown[];
    existing.push({ ...input, ticketId, createdAt, status: 'queued' });
    localStorage.setItem(storageKey, JSON.stringify(existing.slice(-20)));
  } catch {
    /* localStorage can be unavailable in private browsing; the demo still works */
  }

  return {
    ticketId,
    status: 'queued',
    createdAt,
    estimatedResponseMinutes: 15,
    delivery: 'local-demo',
  };
}
