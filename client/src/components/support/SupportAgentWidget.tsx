import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Bot,
  CheckCircle2,
  ChevronRight,
  Headset,
  Loader2,
  Send,
  Sparkles,
  UserRound,
  X,
} from 'lucide-react';
import {
  SupportAudience,
  SupportChatMessage,
  SupportEscalationResponse,
  SupportProvider,
  SupportTopic,
} from '@driver-hub/shared';
import { requestSupportChat, submitSupportEscalation } from '../../services/supportApi';

interface SupportAgentWidgetProps {
  audience: SupportAudience;
  buttonClassName?: string;
}

interface ChatEntry extends SupportChatMessage {
  id: string;
  provider?: SupportProvider;
}

type WidgetMode = 'chat' | 'form' | 'success';

const GREETING: ChatEntry = {
  id: 'greeting',
  role: 'assistant',
  content:
    '¡Hola! Soy Nova, el agente de soporte de Driver Hub. Puedo ayudarte con viajes, pagos, cuenta o seguridad. ¿Qué necesitas?',
};

const QUICK_QUESTIONS = [
  '¿Cómo cancelo un viaje?',
  'Mi conductor no llega',
  'Me cobraron de más',
  'Perdí un objeto',
];

const TOPICS: Array<{ value: SupportTopic; label: string }> = [
  { value: 'ride', label: 'Viaje' },
  { value: 'account', label: 'Cuenta y acceso' },
  { value: 'payment', label: 'Pagos y reembolsos' },
  { value: 'safety', label: 'Seguridad' },
  { value: 'lost_item', label: 'Objeto perdido' },
  { value: 'other', label: 'Otro' },
];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function nextId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export const SupportAgentWidget: React.FC<SupportAgentWidgetProps> = ({
  audience,
  buttonClassName = 'absolute top-2 right-3 z-[1000]',
}) => {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<WidgetMode>('chat');
  const [messages, setMessages] = useState<ChatEntry[]>([GREETING]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [provider, setProvider] = useState<SupportProvider | null>(null);
  const [escalationSuggested, setEscalationSuggested] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '',
    email: '',
    topic: 'ride' as SupportTopic,
    message: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [ticket, setTicket] = useState<SupportEscalationResponse | null>(null);

  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages, isSending, open, mode, escalationSuggested]);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => inputRef.current?.focus(), 150);
    return () => clearTimeout(timer);
  }, [open, mode]);

  const sendMessage = async (rawText: string) => {
    const text = rawText.trim();
    if (!text || isSending) return;

    const userEntry: ChatEntry = { id: nextId(), role: 'user', content: text };
    const history = [...messages, userEntry];
    setMessages(history);
    setInput('');
    setChatError(null);
    setEscalationSuggested(false);
    setIsSending(true);

    try {
      const response = await requestSupportChat(
        history.map(({ role, content }) => ({ role, content })),
        audience,
      );
      setProvider(response.provider);
      setEscalationSuggested(response.escalationSuggested);
      setMessages((current) => [
        ...current,
        {
          id: nextId(),
          role: 'assistant',
          content: response.reply,
          provider: response.provider,
        },
      ]);
    } catch (error) {
      setChatError(
        error instanceof Error
          ? error.message
          : 'No pude enviar tu mensaje. Intenta de nuevo.',
      );
    } finally {
      setIsSending(false);
    }
  };

  const openEscalation = () => {
    const lastQuestion = [...messages]
      .reverse()
      .find((message) => message.role === 'user')?.content;
    setForm((current) => ({
      ...current,
      message: current.message || lastQuestion || '',
    }));
    setFormError(null);
    setMode('form');
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSubmitting) return;

    if (form.name.trim().length < 2) {
      setFormError('Escribe tu nombre.');
      return;
    }
    if (!EMAIL_PATTERN.test(form.email.trim())) {
      setFormError('Escribe un correo válido.');
      return;
    }
    if (form.message.trim().length < 5) {
      setFormError('Cuéntanos un poco más para poder ayudarte.');
      return;
    }

    setFormError(null);
    setIsSubmitting(true);
    try {
      const response = await submitSupportEscalation({
        name: form.name.trim(),
        email: form.email.trim(),
        topic: form.topic,
        message: form.message.trim(),
        audience,
        transcript: messages.map(({ role, content }) => ({ role, content })),
      });
      setTicket(response);
      setMode('success');
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : 'No pude enviar el mensaje. Intenta de nuevo.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetConversation = () => {
    setMessages([GREETING]);
    setProvider(null);
    setEscalationSuggested(false);
    setChatError(null);
    setInput('');
    setTicket(null);
    setMode('chat');
  };

  const statusLabel =
    provider === 'opencode'
      ? 'OpenCode · deepseek-v4.1-flash-free'
      : provider === 'demo-fallback'
        ? 'Modo demo local'
        : 'Asistente IA · en línea';

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${buttonClassName} flex items-center gap-1.5 rounded-full bg-gradient-to-r from-indigo-600 to-blue-600 px-3 py-1.5 text-[11px] font-bold text-white shadow-lg shadow-indigo-900/40 ring-1 ring-white/10 transition-all hover:from-indigo-500 hover:to-blue-500 active:scale-95`}
        aria-label="Abrir soporte con IA"
      >
        <Headset size={13} />
        <span>Soporte</span>
        <Sparkles size={11} className="text-amber-300" />
      </button>

      {open && (
        <div
          className="absolute inset-0 z-[2000] flex flex-col bg-slate-950/95 backdrop-blur-md animate-fadeIn"
          role="dialog"
          aria-modal="true"
          aria-label="Soporte Driver Hub"
        >
          <header className="flex items-center gap-2.5 border-b border-slate-800 bg-slate-900/95 px-3 py-2.5">
            {mode !== 'chat' ? (
              <button
                type="button"
                onClick={() => setMode('chat')}
                className="rounded-full p-1.5 text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
                aria-label="Volver al chat"
              >
                <ArrowLeft size={16} />
              </button>
            ) : (
              <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-md">
                <Bot size={17} />
                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-slate-900 bg-emerald-400" />
              </div>
            )}

            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-white">
                {mode === 'form'
                  ? 'Hablar con una persona'
                  : mode === 'success'
                    ? 'Mensaje enviado'
                    : 'Soporte Driver Hub'}
              </p>
              <p className="truncate text-[10px] text-slate-400">
                {mode === 'form'
                  ? 'Envía tu caso a un representante'
                  : mode === 'success'
                    ? 'Tu caso está en la cola de soporte'
                    : statusLabel}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
              aria-label="Cerrar soporte"
            >
              <X size={17} />
            </button>
          </header>

          {mode === 'chat' && (
            <div className="flex min-h-0 flex-1 flex-col">
              <button
                type="button"
                onClick={openEscalation}
                className="mx-3 mt-2 flex items-center justify-between rounded-xl border border-slate-700/70 bg-slate-900/80 px-3 py-2 text-left transition-colors hover:border-indigo-500/60 hover:bg-slate-800/80"
              >
                <span className="flex items-center gap-2">
                  <UserRound size={14} className="text-indigo-300" />
                  <span className="text-[11px] font-semibold text-slate-200">
                    ¿Necesitas una persona?
                  </span>
                </span>
                <span className="flex items-center gap-1 text-[10px] font-bold text-indigo-300">
                  Hablar con soporte
                  <ChevronRight size={12} />
                </span>
              </button>

              <div
                ref={listRef}
                className="flex-1 space-y-2.5 overflow-y-auto px-3 py-3"
              >
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex items-end gap-1.5 ${
                      message.role === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    {message.role === 'assistant' && (
                      <div className="mb-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-300">
                        <Sparkles size={11} />
                      </div>
                    )}
                    <div
                      className={`max-w-[82%] rounded-2xl px-3 py-2 text-[11px] leading-relaxed shadow-sm ${
                        message.role === 'user'
                          ? 'rounded-br-sm bg-blue-600 text-white'
                          : 'rounded-bl-sm border border-slate-700/60 bg-slate-800/90 text-slate-100'
                      }`}
                    >
                      {message.content}
                    </div>
                  </div>
                ))}

                {isSending && (
                  <div className="flex items-end gap-1.5">
                    <div className="mb-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-300">
                      <Sparkles size={11} />
                    </div>
                    <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm border border-slate-700/60 bg-slate-800/90 px-3 py-2.5">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" />
                    </div>
                  </div>
                )}

                {chatError && (
                  <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-2.5 py-2 text-[10px] text-rose-300">
                    {chatError}
                  </p>
                )}

                {escalationSuggested && !isSending && (
                  <button
                    type="button"
                    onClick={openEscalation}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-indigo-500/40 bg-indigo-500/10 px-3 py-2 text-[10px] font-bold text-indigo-200 transition-colors hover:bg-indigo-500/20"
                  >
                    <UserRound size={12} />
                    Enviar este caso a una persona
                  </button>
                )}

                {messages.length <= 1 && !isSending && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {QUICK_QUESTIONS.map((question) => (
                      <button
                        key={question}
                        type="button"
                        onClick={() => void sendMessage(question)}
                        className="rounded-full border border-slate-700 bg-slate-900/80 px-2.5 py-1 text-[10px] font-medium text-slate-300 transition-colors hover:border-indigo-500/60 hover:text-indigo-200"
                      >
                        {question}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void sendMessage(input);
                }}
                className="border-t border-slate-800 bg-slate-900/95 p-2.5"
              >
                <div className="flex items-center gap-1.5 rounded-xl border border-slate-700/80 bg-slate-800/80 px-2 py-1.5 focus-within:border-indigo-500/60">
                  <input
                    ref={inputRef}
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    placeholder="Escribe tu pregunta..."
                    maxLength={2000}
                    disabled={isSending}
                    className="min-w-0 flex-1 bg-transparent px-1 text-[11px] text-slate-100 placeholder:text-slate-500 focus:outline-none disabled:opacity-60"
                  />
                  <button
                    type="submit"
                    disabled={isSending || !input.trim()}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500"
                    aria-label="Enviar mensaje"
                  >
                    {isSending ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Send size={13} />
                    )}
                  </button>
                </div>
                <p className="mt-1.5 text-center text-[9px] leading-tight text-slate-500">
                  La IA puede cometer errores. Para casos urgentes, habla con un representante.
                </p>
              </form>
            </div>
          )}

          {mode === 'form' && (
            <form
              onSubmit={handleSubmit}
              className="flex min-h-0 flex-1 flex-col overflow-y-auto p-3"
            >
              <p className="mb-3 rounded-xl border border-slate-800 bg-slate-900/70 px-2.5 py-2 text-[10px] leading-relaxed text-slate-400">
                Cuéntanos qué pasó y un representante revisará tu caso. Este formulario es un
                placeholder de demostración.
              </p>

              <div className="space-y-2.5">
                <label className="block">
                  <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    Nombre
                  </span>
                  <input
                    value={form.name}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, name: event.target.value }))
                    }
                    maxLength={80}
                    placeholder="Tu nombre"
                    className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-2.5 py-2 text-[11px] text-slate-100 placeholder:text-slate-500 focus:border-indigo-500/60 focus:outline-none"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    Correo
                  </span>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, email: event.target.value }))
                    }
                    maxLength={160}
                    placeholder="tu@correo.com"
                    className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-2.5 py-2 text-[11px] text-slate-100 placeholder:text-slate-500 focus:border-indigo-500/60 focus:outline-none"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    Tema
                  </span>
                  <select
                    value={form.topic}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        topic: event.target.value as SupportTopic,
                      }))
                    }
                    className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-2.5 py-2 text-[11px] text-slate-100 focus:border-indigo-500/60 focus:outline-none"
                  >
                    {TOPICS.map((topic) => (
                      <option key={topic.value} value={topic.value}>
                        {topic.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    Mensaje
                  </span>
                  <textarea
                    value={form.message}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, message: event.target.value }))
                    }
                    rows={4}
                    maxLength={4000}
                    placeholder="Describe tu caso..."
                    className="w-full resize-none rounded-xl border border-slate-700 bg-slate-800/80 px-2.5 py-2 text-[11px] leading-relaxed text-slate-100 placeholder:text-slate-500 focus:border-indigo-500/60 focus:outline-none"
                  />
                </label>
              </div>

              {formError && (
                <p className="mt-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-2.5 py-2 text-[10px] text-rose-300">
                  {formError}
                </p>
              )}

              <div className="mt-auto pt-3">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 py-2.5 text-xs font-bold text-white shadow-lg shadow-indigo-900/30 transition-all hover:from-indigo-500 hover:to-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Send size={13} />
                  )}
                  {isSubmitting ? 'Enviando...' : 'Enviar a soporte'}
                </button>
                <button
                  type="button"
                  onClick={() => setMode('chat')}
                  className="mt-1.5 w-full rounded-xl py-2 text-[10px] font-semibold text-slate-400 transition-colors hover:text-slate-200"
                >
                  Volver al chat con Nova
                </button>
              </div>
            </form>
          )}

          {mode === 'success' && ticket && (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-5 text-center">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full border border-emerald-400/40 bg-emerald-500/15">
                <CheckCircle2 size={30} className="text-emerald-400" />
              </div>
              <h3 className="text-sm font-bold text-white">Tu mensaje fue enviado</h3>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                Un representante revisará tu caso y te responderá por correo en
                aproximadamente {ticket.estimatedResponseMinutes} minutos.
              </p>

              <div className="my-4 w-full rounded-2xl border border-slate-800 bg-slate-900/80 p-3">
                <p className="text-[9px] font-bold uppercase tracking-wide text-slate-500">
                  Número de ticket
                </p>
                <p className="mt-1 font-mono text-sm font-black text-indigo-300">
                  {ticket.ticketId}
                </p>
                <p className="mt-1 text-[9px] text-slate-500">
                  {ticket.delivery === 'server'
                    ? 'En cola de soporte del servidor'
                    : 'Guardado localmente (modo demo)'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setMode('chat')}
                className="w-full rounded-xl bg-slate-800 py-2.5 text-xs font-bold text-slate-200 transition-colors hover:bg-slate-700"
              >
                Volver al chat
              </button>
              <button
                type="button"
                onClick={resetConversation}
                className="mt-1.5 w-full rounded-xl py-2 text-[10px] font-semibold text-slate-400 transition-colors hover:text-slate-200"
              >
                Nueva conversación
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
};
