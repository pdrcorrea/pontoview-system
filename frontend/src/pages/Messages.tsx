import { useCallback, useEffect, useState, type FormEvent } from "react";
import { AlertTriangle, CheckCircle2, Info, MessageSquareText, Pencil, Power, Trash2 } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import {
  AsyncButton,
  EmptyState,
  FormMessage,
  Modal,
  PageHead,
  formData,
} from "../components/ui";
import { supabase } from "../lib/supabase";
import type {
  MessageDisplayLocation,
  MessageDurationMode,
  MessagePriority,
  MessageStyleVariant,
  Screen,
} from "../types";

type MessageRow = {
  id: string;
  title: string | null;
  body: string;
  starts_at: string | null;
  ends_at: string | null;
  weekdays: number[];
  start_time: string;
  end_time: string;
  is_active: boolean;
  display_location: MessageDisplayLocation;
  priority: MessagePriority;
  duration_mode: MessageDurationMode;
  duration_seconds: number | null;
  style_variant: MessageStyleVariant;
  is_exclusive: boolean;
  message_screens: Array<{ screen_id: string }>;
};

const weekdays = [
  [0, "Dom"], [1, "Seg"], [2, "Ter"], [3, "Qua"], [4, "Qui"], [5, "Sex"], [6, "Sáb"],
] as const;

export function MessagesPage() {
  const { organization, user } = useAuth();
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [screens, setScreens] = useState<Screen[]>([]);
  const [editing, setEditing] = useState<MessageRow | null | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!organization) return;
    const [m, s] = await Promise.all([
      supabase.from("messages")
        .select("id,title,body,starts_at,ends_at,weekdays,start_time,end_time,is_active,display_location,priority,duration_mode,duration_seconds,style_variant,is_exclusive,message_screens(screen_id)")
        .eq("organization_id", organization.id)
        .order("created_at", { ascending: false }),
      supabase.from("screens")
        .select("id,organization_id,name,slug,orientation,default_playlist_id,is_active,settings_revision")
        .eq("organization_id", organization.id)
        .eq("is_active", true)
        .order("name"),
    ]);
    if (m.error) setError(m.error.message);
    else setMessages((m.data || []) as unknown as MessageRow[]);
    if (s.data) setScreens(s.data as Screen[]);
  }, [organization]);

  useEffect(() => { void load(); }, [load]);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!organization || !user) return;
    setBusy(true);
    setError(null);
    const values = formData(event);
    const raw = new FormData(event.currentTarget);
    const days = weekdays.filter(([day]) => raw.has(`day_${day}`)).map(([day]) => day);
    const targets = screens.filter((screen) => raw.has(`screen_${screen.id}`)).map((screen) => screen.id);
    const durationMode = (values.duration_mode || "auto") as MessageDurationMode;
    const manualDuration = durationMode === "manual" ? Math.max(5, Math.min(120, Number(values.duration_seconds || 10))) : null;

    const payload = {
      organization_id: organization.id,
      title: values.title || null,
      body: values.body,
      starts_at: values.starts_at ? new Date(values.starts_at).toISOString() : null,
      ends_at: values.ends_at ? new Date(values.ends_at).toISOString() : null,
      weekdays: days.length ? days : weekdays.map(([day]) => day),
      start_time: values.start_time || "00:00",
      end_time: values.end_time || "23:59",
      display_location: (values.display_location || "footer") as MessageDisplayLocation,
      priority: (values.priority || "normal") as MessagePriority,
      duration_mode: durationMode,
      duration_seconds: manualDuration,
      style_variant: (values.style_variant || "standard") as MessageStyleVariant,
      is_exclusive: raw.has("is_exclusive"),
      is_active: editing ? editing.is_active : true,
      created_by: user.id,
    };

    const result = editing
      ? await supabase.from("messages").update(payload).eq("id", editing.id).select("id").single()
      : await supabase.from("messages").insert(payload).select("id").single();

    if (result.error) {
      setError(result.error.message);
      setBusy(false);
      return;
    }

    const messageId = result.data.id;
    const cleared = await supabase.from("message_screens").delete().eq("message_id", messageId);
    const targeted = targets.length
      ? await supabase.from("message_screens").insert(targets.map((screenId) => ({
          organization_id: organization.id,
          message_id: messageId,
          screen_id: screenId,
        })))
      : { error: null };

    setBusy(false);
    if (cleared.error || targeted.error) {
      setError(cleared.error?.message || targeted.error?.message || "Erro ao direcionar a mensagem.");
      return;
    }
    setEditing(undefined);
    await load();
  };

  const toggle = async (message: MessageRow) => {
    const r = await supabase.from("messages").update({ is_active: !message.is_active }).eq("id", message.id);
    if (r.error) setError(r.error.message); else await load();
  };

  const remove = async (message: MessageRow) => {
    if (!confirm(`Excluir “${message.title || message.body.slice(0, 30)}”?`)) return;
    const r = await supabase.from("messages").delete().eq("id", message.id);
    if (r.error) setError(r.error.message); else await load();
  };

  return (
    <>
      <PageHead eyebrow="Comunicação" title="Mensagens" text="Programe avisos, defina prioridade e escolha como cada mensagem ganha destaque nas telas." action="Nova mensagem" onAction={() => setEditing(null)} />
      <FormMessage error={error} />
      {messages.length ? (
        <div className="message-grid">
          {messages.map((message) => (
            <article className={`panel message-card message-card-${message.priority}`} key={message.id}>
              <div className="schedule-actions">
                <span className={message.is_active ? "status active" : "status offline-status"}>{message.is_active ? "Ativa" : "Pausada"}</span>
                <button className="icon-button" title="Editar" onClick={() => setEditing(message)}><Pencil /></button>
                <button className="icon-button" title={message.is_active ? "Pausar" : "Ativar"} onClick={() => void toggle(message)}><Power /></button>
                <button className="icon-button danger-hover" title="Excluir" onClick={() => void remove(message)}><Trash2 /></button>
              </div>
              <span className="message-icon"><MessageSquareText /></span>
              <div className="message-badges">
                <span>{priorityLabel(message.priority)}</span>
                {message.is_exclusive && <span>Destaque exclusivo</span>}
              </div>
              <h2>{message.title || "Comunicado"}</h2>
              <p>{message.body}</p>
              <strong>{message.start_time.slice(0, 5)} → {message.end_time.slice(0, 5)}</strong>
              <small>{formatDays(message.weekdays)} · {targetLabel(message, screens)} · {locationLabel(message.display_location)} · {durationLabel(message)}</small>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState icon={<MessageSquareText />} title="Nenhuma mensagem programada" text="Crie avisos para a barra inferior ou para a área lateral de destaque." action="Criar primeira mensagem" onAction={() => setEditing(null)} />
      )}
      {editing !== undefined && <MessageModal message={editing} screens={screens} busy={busy} error={error} onClose={() => setEditing(undefined)} onSubmit={save} />}
    </>
  );
}

function MessageModal({ message, screens, busy, error, onClose, onSubmit }: {
  message: MessageRow | null;
  screens: Screen[];
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const targeted = new Set(message?.message_screens.map((row) => row.screen_id) || []);
  const [title, setTitle] = useState(message?.title || "");
  const [body, setBody] = useState(message?.body || "");
  const [location, setLocation] = useState<MessageDisplayLocation>(message?.display_location || "footer");
  const [priority, setPriority] = useState<MessagePriority>(message?.priority || "normal");
  const [durationMode, setDurationMode] = useState<MessageDurationMode>(message?.duration_mode || "auto");
  const [duration, setDuration] = useState(message?.duration_seconds || 12);
  const [variant, setVariant] = useState<MessageStyleVariant>(message?.style_variant || "standard");
  const [exclusive, setExclusive] = useState(Boolean(message?.is_exclusive));

  return (
    <Modal eyebrow="MENSAGEM PROGRAMADA" title={message ? "Editar mensagem" : "Nova mensagem"} onClose={onClose}>
      <form className="youtube-form message-form" onSubmit={onSubmit}>
        <label>Título <span>(opcional)</span><input name="title" value={title} onChange={(e) => setTitle(e.target.value)} /></label>
        <label>Mensagem<textarea name="body" rows={4} required value={body} onChange={(e) => setBody(e.target.value)} /></label>

        <div className="message-options-grid">
          <label>Local de exibição
            <select name="display_location" value={location} onChange={(e) => setLocation(e.target.value as MessageDisplayLocation)}>
              <option value="footer">Barra inferior</option>
              <option value="sidebar">Área lateral de destaque</option>
            </select>
          </label>
          <label>Prioridade
            <select name="priority" value={priority} onChange={(e) => setPriority(e.target.value as MessagePriority)}>
              <option value="normal">Normal</option>
              <option value="important">Importante</option>
              <option value="urgent">Urgente</option>
            </select>
          </label>
        </div>

        <div className="message-options-grid">
          <label>Estilo visual
            <select name="style_variant" value={variant} onChange={(e) => setVariant(e.target.value as MessageStyleVariant)}>
              <option value="standard">Comunicado</option>
              <option value="attention">Atenção</option>
              <option value="info">Informativo</option>
              <option value="success">Positivo / Sucesso</option>
            </select>
          </label>
          <label>Tempo de exibição
            <select name="duration_mode" value={durationMode} onChange={(e) => setDurationMode(e.target.value as MessageDurationMode)}>
              <option value="auto">Automático pela leitura</option>
              <option value="manual">Definir manualmente</option>
            </select>
          </label>
        </div>

        {durationMode === "manual" && <label>Segundos em tela <span>(5 a 120 segundos)</span><input name="duration_seconds" type="number" min={5} max={120} value={duration} onChange={(e) => setDuration(Number(e.target.value))} /></label>}
        {durationMode === "auto" && <input type="hidden" name="duration_seconds" value="" />}

        <label className="message-exclusive-option">
          <input type="checkbox" name="is_exclusive" checked={exclusive} onChange={(e) => setExclusive(e.target.checked)} />
          <span><b>Destacar temporariamente</b><small>Quando ativa e na área lateral, esta mensagem ocupa o espaço informativo sozinha até sair da programação.</small></span>
        </label>

        <MessageLivePreview title={title} body={body} location={location} priority={priority} variant={variant} exclusive={exclusive} durationMode={durationMode} duration={duration} />

        <div className="weekday-picker">
          {weekdays.map(([day, label]) => (
            <label key={day}><input type="checkbox" name={`day_${day}`} defaultChecked={!message || message.weekdays.includes(day)} /><span>{label}</span></label>
          ))}
        </div>
        <div className="form-row">
          <label>Horário inicial<input name="start_time" type="time" required defaultValue={message?.start_time.slice(0, 5) || "00:00"} /></label>
          <label>Horário final<input name="end_time" type="time" required defaultValue={message?.end_time.slice(0, 5) || "23:59"} /></label>
        </div>
        <div className="form-row">
          <label>Data inicial <span>(opcional)</span><input name="starts_at" type="datetime-local" defaultValue={toLocalInput(message?.starts_at)} /></label>
          <label>Data final <span>(opcional)</span><input name="ends_at" type="datetime-local" defaultValue={toLocalInput(message?.ends_at)} /></label>
        </div>
        <fieldset className="screen-picker">
          <legend>Telas <span>(nenhuma seleção envia para todas)</span></legend>
          {screens.length ? screens.map((screen) => (
            <label key={screen.id}><input type="checkbox" name={`screen_${screen.id}`} defaultChecked={targeted.has(screen.id)} /><span>{screen.name}</span></label>
          )) : <small>Conecte uma tela para criar um direcionamento específico.</small>}
        </fieldset>
        <FormMessage error={error} />
        <div className="modal-actions">
          <button type="button" className="btn secondary" onClick={onClose}>Cancelar</button>
          <AsyncButton busy={busy} className="btn primary">Salvar mensagem</AsyncButton>
        </div>
      </form>
    </Modal>
  );
}

function MessageLivePreview({ title, body, location, priority, variant, exclusive, durationMode, duration }: {
  title: string; body: string; location: MessageDisplayLocation; priority: MessagePriority; variant: MessageStyleVariant; exclusive: boolean; durationMode: MessageDurationMode; duration: number;
}) {
  const Icon = variant === "attention" ? AlertTriangle : variant === "info" ? Info : variant === "success" ? CheckCircle2 : MessageSquareText;
  return (
    <section className="message-live-preview">
      <div className="message-preview-head"><span>PRÉ-VISUALIZAÇÃO</span><small>{location === "sidebar" ? "Área lateral" : "Barra inferior"} · {priorityLabel(priority)} · {durationMode === "manual" ? `${duration}s` : "tempo automático"}</small></div>
      <div className={`message-preview-canvas ${location} variant-${variant} priority-${priority}`}>
        {location === "sidebar" ? (
          <div className="message-preview-side"><span><Icon /> {exclusive ? "DESTAQUE" : "MENSAGEM"}</span>{title && <b>{title}</b>}<p>{body || "Digite a mensagem para visualizar como ela aparecerá na tela."}</p></div>
        ) : (
          <div className="message-preview-footer"><b>{priority === "urgent" ? "URGENTE" : "AVISO"}</b><span>{body || title || "Sua mensagem aparecerá aqui."}</span></div>
        )}
      </div>
    </section>
  );
}

function formatDays(days: number[]) {
  if (days.length === 7) return "Todos os dias";
  return weekdays.filter(([day]) => days.includes(day)).map(([, label]) => label).join(", ");
}
function targetLabel(message: MessageRow, screens: Screen[]) {
  const targets = message.message_screens.map((row) => screens.find((screen) => screen.id === row.screen_id)?.name).filter(Boolean);
  return targets.length ? targets.join(", ") : "Todas as telas";
}
function locationLabel(location: MessageDisplayLocation) { return location === "sidebar" ? "Área lateral" : "Barra inferior"; }
function priorityLabel(priority: MessagePriority) { return priority === "urgent" ? "Urgente" : priority === "important" ? "Importante" : "Normal"; }
function durationLabel(message: MessageRow) { return message.duration_mode === "manual" && message.duration_seconds ? `${message.duration_seconds}s` : "Tempo automático"; }
function toLocalInput(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
