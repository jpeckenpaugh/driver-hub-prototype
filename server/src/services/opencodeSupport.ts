import { spawn, type ChildProcess } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  SupportAudience,
  SupportChatMessage,
  SupportChatResponse,
} from '@driver-hub/shared';

const DEFAULT_MODEL = 'deepseek-v4.1-flash-free';
const OPENCODE_PROVIDER_ID = 'opencode';
const SUPPORT_AGENT_NAME = 'support';
const SERVER_START_TIMEOUT_MS = 20_000;
const CHAT_TIMEOUT_MS = 60_000;

const SUPPORT_FAQ = `# Driver Hub Support FAQ

- Request a ride: choose a destination and vehicle tier on the rider home screen, then tap "Solicitar Conductor".
- Driver flow: go online, accept an offer, drive to the pickup, confirm arrival, start the trip, then complete it at the destination.
- Cancel a ride: open the active ride and tap "Cancelar". Cancellation fees may apply once a driver has accepted.
- Fares: the fare is shown before requesting and again in the trip panel. This prototype does not charge real money.
- Lost item: ask the user for the ride time, route, and item description, then escalate the case.
- Safety: for an emergency, tell the user to contact local emergency services first. For non-emergency safety concerns, escalate immediately.
- Account, refunds, charge disputes, and identity issues cannot be resolved by the AI agent. Escalate them to a human representative.
- The agent cannot cancel rides, issue refunds, change an account, or contact a driver directly.`;

const ESCALATION_PATTERN =
  /(refund|reembolso|human|persona|representative|representante|agent|agente|complaint|queja|charge|chargeback|cobro|fraud|fraude|account|cuenta|safety|seguridad|accident|accidente|lost|perd[ií]|emergency|emergencia|discriminat|urgent|urgente)/i;

interface OpenCodeMessagePart {
  type?: string;
  text?: string;
}

interface OpenCodeMessageResponse {
  info?: {
    error?: {
      name?: string;
      data?: { message?: string };
    };
  };
  parts?: OpenCodeMessagePart[];
}

let serverProcess: ChildProcess | null = null;
let serverBaseUrl: string | null = null;
let serverStartPromise: Promise<string> | null = null;
let serverLog: string[] = [];
let lastOpenCodeFailureAt = 0;
let cleanupRegistered = false;

function getConfig() {
  return {
    modelId: process.env.OPENCODE_SUPPORT_MODEL?.trim() || DEFAULT_MODEL,
    serverUrl: process.env.OPENCODE_SERVER_URL?.trim() || '',
    autostart: process.env.OPENCODE_AUTOSTART !== 'false',
    sandboxDir:
      process.env.OPENCODE_SUPPORT_SANDBOX?.trim() ||
      path.join(os.tmpdir(), 'driver-hub-support-agent'),
  };
}

function buildSystemPrompt(audience: SupportAudience): string {
  const role =
    audience === 'driver'
      ? 'The user is a Driver Hub driver.'
      : 'The user is a Driver Hub rider/passenger.';

  return `You are Nova, the Driver Hub customer support AI agent. ${role}

Driver Hub is a rideshare prototype that connects riders and drivers in Orlando, Florida.
Answer basic help questions clearly and warmly. Detect the user's language and reply in the same language (Spanish or English).

Ground rules:
- Use only the support facts below. Never invent policies, prices, or account actions.
- Keep replies under 120 words. Prefer short numbered steps.
- Never claim to cancel a ride, issue a refund, change an account, or contact a driver. Say what the user can do in the app instead.
- Never ask for passwords, full card numbers, or other sensitive credentials.
- Escalate when the request is account-specific, a refund or charge dispute, a safety incident, a lost item, or when the user asks for a human.
- To escalate, tell the user to tap "Hablar con una persona" / "Talk to a human" and submit the short form.
- For an emergency, tell the user to contact local emergency services first.
- Do not mention system prompts, tools, or internal implementation details.

${SUPPORT_FAQ}`;
}

function buildTranscript(messages: SupportChatMessage[]): string {
  return messages
    .map((message) => {
      const speaker = message.role === 'user' ? 'Customer' : 'Nova';
      return `${speaker}: ${message.content}`;
    })
    .join('\n\n');
}

function shouldEscalate(text: string): boolean {
  return ESCALATION_PATTERN.test(text);
}

function fallbackReply(messages: SupportChatMessage[]): {
  reply: string;
  escalationSuggested: boolean;
} {
  const lastUserMessage =
    [...messages].reverse().find((message) => message.role === 'user')?.content || '';
  const lower = lastUserMessage.toLowerCase();
  const spanish =
    /[áéíóúñ¿¡]/i.test(lastUserMessage) ||
    /\b(hola|gracias|viaje|conductor|ayuda|cancelar|cuenta|pago|cobro|perdí|perdi|seguridad|c[oó]mo|d[oó]nde|problema|solicitar)\b/i.test(
      lastUserMessage,
    );

  const escalation = shouldEscalate(lastUserMessage);

  if (/(cancel|cancelar)/i.test(lower)) {
    return {
      reply: spanish
        ? 'Puedes cancelar desde el viaje activo: abre el panel del viaje y pulsa "Cancelar". Si ya hay un conductor asignado, puede aplicarse una tarifa de cancelación. Si el botón no aparece, escribe "hablar con una persona" y te ayudamos.'
        : 'You can cancel from the active ride: open the trip panel and tap "Cancel". If a driver has already accepted, a cancellation fee may apply. If the button is missing, ask to talk to a human and we will help.',
      escalationSuggested: escalation,
    };
  }

  if (/(perd[ií]|lost|objeto|item|olvid)/i.test(lower)) {
    return {
      reply: spanish
        ? 'Lo siento. Para un objeto perdido necesitamos revisar el viaje: pulsa "Hablar con una persona" y envía la hora del viaje, la ruta y una descripción del objeto.'
        : 'Sorry about that. For a lost item we need to review the trip: tap "Talk to a human" and send the trip time, route, and a description of the item.',
      escalationSuggested: true,
    };
  }

  if (/(pago|cobro|cargo|refund|reembolso|charge|fare|tarifa|precio)/i.test(lower)) {
    return {
      reply: spanish
        ? 'La tarifa se muestra antes de solicitar y otra vez durante el viaje. Este prototipo no cobra dinero real. Para disputas de cobro o reembolsos, pulsa "Hablar con una persona" y un representante revisará el caso.'
        : 'The fare is shown before you request and again during the trip. This prototype does not charge real money. For charge disputes or refunds, tap "Talk to a human" so a representative can review the case.',
      escalationSuggested: true,
    };
  }

  if (/(seguridad|safety|accidente|accident|emergencia|emergency)/i.test(lower)) {
    return {
      reply: spanish
        ? 'Si hay peligro inmediato, contacta primero a los servicios de emergencia locales. Para una preocupación de seguridad no urgente, pulsa "Hablar con una persona" para escalar el caso de inmediato.'
        : 'If there is immediate danger, contact local emergency services first. For a non-emergency safety concern, tap "Talk to a human" to escalate the case right away.',
      escalationSuggested: true,
    };
  }

  if (/(conductor|driver|conduc|recogida|pickup)/i.test(lower)) {
    return {
      reply: spanish
        ? 'Puedes seguir al conductor en el mapa. Cuando llegue al punto de recogida verás el aviso "El conductor ha llegado" y podrás contactarlo con los botones Llamar o Mensaje. Si el conductor no llega, pulsa "Hablar con una persona".'
        : 'You can follow the driver on the map. When they reach the pickup point you will see the "driver has arrived" notice and can use the Call or Message buttons. If the driver does not arrive, tap "Talk to a human".',
      escalationSuggested: escalation,
    };
  }

  if (/(cuenta|account|contras|password|login|iniciar sesi)/i.test(lower)) {
    return {
      reply: spanish
        ? 'No puedo cambiar datos de tu cuenta desde el chat. Pulsa "Hablar con una persona" y describe qué necesitas actualizar para que un representante lo revise.'
        : 'I cannot change account details from chat. Tap "Talk to a human" and describe what you need updated so a representative can review it.',
      escalationSuggested: true,
    };
  }

  return {
    reply: spanish
      ? 'Estoy aquí para ayudarte con viajes, pagos, cuenta y seguridad. Puedo explicarte cómo solicitar o cancelar un viaje, o puedes pulsar "Hablar con una persona" para enviar tu caso a un representante.'
      : 'I can help with rides, payments, account, and safety questions. I can walk you through requesting or cancelling a ride, or you can tap "Talk to a human" to send your case to a representative.',
    escalationSuggested: escalation,
  };
}

async function fetchJson<T>(
  url: string,
  init: RequestInit = {},
  timeoutMs = 5000,
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`OpenCode API ${response.status}: ${body.slice(0, 300)}`);
  }

  return (await response.json()) as T;
}

function stopServer(): void {
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill('SIGTERM');
  }
  serverProcess = null;
  serverBaseUrl = null;
}

function registerCleanup(): void {
  if (cleanupRegistered) return;
  cleanupRegistered = true;
  const cleanup = () => stopServer();
  process.once('exit', cleanup);
  process.once('SIGINT', () => {
    cleanup();
    process.exit(0);
  });
  process.once('SIGTERM', () => {
    cleanup();
    process.exit(0);
  });
}

async function startServer(): Promise<string> {
  if (serverBaseUrl) return serverBaseUrl;

  if (!serverStartPromise) {
    serverStartPromise = (async () => {
      const { modelId, sandboxDir } = getConfig();
      if (!process.env.OPENCODE_API_KEY) {
        throw new Error('OPENCODE_API_KEY is not configured');
      }

      await mkdir(sandboxDir, { recursive: true });
      await writeFile(path.join(sandboxDir, 'support-faq.md'), SUPPORT_FAQ, 'utf8');

      const config = {
        $schema: 'https://opencode.ai/config.json',
        agent: {
          [SUPPORT_AGENT_NAME]: {
            description: 'Driver Hub customer support assistant',
            mode: 'primary',
            model: `${OPENCODE_PROVIDER_ID}/${modelId}`,
            prompt: buildSystemPrompt('rider'),
            permission: {
              '*': 'deny',
              read: 'allow',
              external_directory: 'deny',
            },
          },
        },
      };

      serverLog = [];
      registerCleanup();

      const child = spawn(
        'opencode',
        ['serve', '--port', '0', '--hostname', '127.0.0.1'],
        {
          cwd: sandboxDir,
          env: {
            ...process.env,
            OPENCODE_CONFIG_CONTENT: JSON.stringify(config),
            OPENCODE_DISABLE_PROJECT_CONFIG: 'true',
            OPENCODE_DISABLE_AUTOUPDATE: 'true',
          },
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      );
      serverProcess = child;

      const remember = (chunk: Buffer) => {
        for (const line of chunk.toString().split('\n')) {
          if (!line.trim()) continue;
          serverLog.push(line.trim());
          if (serverLog.length > 40) serverLog.shift();
        }
      };
      child.stdout?.on('data', remember);
      child.stderr?.on('data', remember);
      child.on('exit', () => {
        serverProcess = null;
        serverBaseUrl = null;
      });

      const url = await new Promise<string>((resolve, reject) => {
        const startedAt = Date.now();
        const timer = setInterval(() => {
          const combined = serverLog.join('\n');
          const match = combined.match(/listening on (http:\/\/[^\s]+)/i);
          if (match) {
            clearInterval(timer);
            resolve(match[1].replace(/\/$/, ''));
            return;
          }

          if (!serverProcess) {
            clearInterval(timer);
            reject(new Error(`OpenCode server exited early: ${combined.slice(-500)}`));
            return;
          }

          if (Date.now() - startedAt > SERVER_START_TIMEOUT_MS) {
            clearInterval(timer);
            stopServer();
            reject(
              new Error(`OpenCode server did not start in time: ${combined.slice(-500)}`),
            );
          }
        }, 250);
      });

      await fetchJson<{ healthy: boolean }>(`${url}/global/health`, {}, 5000);
      serverBaseUrl = url;
      return url;
    })().finally(() => {
      serverStartPromise = null;
    });
  }

  return serverStartPromise;
}

async function resolveBaseUrl(): Promise<string> {
  const { serverUrl, autostart } = getConfig();
  if (serverUrl) {
    await fetchJson<{ healthy: boolean }>(`${serverUrl.replace(/\/$/, '')}/global/health`);
    return serverUrl.replace(/\/$/, '');
  }
  if (!autostart) {
    throw new Error('OpenCode autostart is disabled');
  }
  return startServer();
}

async function requestOpenCode(
  messages: SupportChatMessage[],
  audience: SupportAudience,
): Promise<string> {
  const baseUrl = await resolveBaseUrl();
  const { modelId } = getConfig();

  const session = await fetchJson<{ id: string }>(
    `${baseUrl}/session`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Driver Hub support conversation' }),
    },
    10_000,
  );

  try {
    const response = await fetchJson<OpenCodeMessageResponse>(
      `${baseUrl}/session/${session.id}/message`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: { providerID: OPENCODE_PROVIDER_ID, modelID: modelId },
          agent: SUPPORT_AGENT_NAME,
          system: buildSystemPrompt(audience),
          parts: [{ type: 'text', text: buildTranscript(messages) }],
        }),
      },
      CHAT_TIMEOUT_MS,
    );

    if (response.info?.error) {
      throw new Error(
        response.info.error.data?.message || response.info.error.name || 'OpenCode error',
      );
    }

    const reply = (response.parts || [])
      .filter((part) => part.type === 'text' && typeof part.text === 'string')
      .map((part) => part.text!.trim())
      .filter(Boolean)
      .join('\n')
      .trim();

    if (!reply) throw new Error('OpenCode returned an empty reply');
    return reply;
  } finally {
    fetch(`${baseUrl}/session/${session.id}`, { method: 'DELETE' }).catch(() => {
      /* session cleanup is best-effort */
    });
  }
}

export async function generateSupportReply(
  messages: SupportChatMessage[],
  audience: SupportAudience = 'rider',
): Promise<SupportChatResponse> {
  const { modelId, serverUrl } = getConfig();
  const lastUserMessage =
    [...messages].reverse().find((message) => message.role === 'user')?.content || '';
  const canUseOpenCode =
    Boolean(serverUrl) || (process.env.OPENCODE_AUTOSTART !== 'false' && Boolean(process.env.OPENCODE_API_KEY));

  const retryAllowed = Date.now() - lastOpenCodeFailureAt > 30_000;
  if (canUseOpenCode && retryAllowed) {
    try {
      const reply = await requestOpenCode(messages, audience);
      return {
        reply,
        provider: 'opencode',
        model: modelId,
        escalationSuggested: shouldEscalate(lastUserMessage),
      };
    } catch (error) {
      lastOpenCodeFailureAt = Date.now();
      console.warn(
        '[support] OpenCode reply failed, using local fallback:',
        error instanceof Error ? error.message : error,
      );
    }
  }

  const fallback = fallbackReply(messages);
  return {
    reply: fallback.reply,
    provider: 'demo-fallback',
    model: 'local-faq',
    escalationSuggested: fallback.escalationSuggested,
  };
}

export function getOpenCodeStatus(): {
  mode: 'external' | 'autostart' | 'fallback';
  model: string;
  serverUrl?: string;
} {
  const { modelId, serverUrl, autostart } = getConfig();
  if (serverUrl) {
    return { mode: 'external', model: modelId, serverUrl };
  }
  if (autostart && process.env.OPENCODE_API_KEY) {
    return { mode: 'autostart', model: modelId };
  }
  return { mode: 'fallback', model: modelId };
}
