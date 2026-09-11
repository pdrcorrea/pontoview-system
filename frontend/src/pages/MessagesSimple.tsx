import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  Check,
  Clock3,
  Info,
  MessageSquareText,
  Monitor,
  Pencil,
  Play,
  Power,
  Trash2,
} from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { AsyncButton, EmptyState, FormMessage, Modal, PageHead, formData } from "../components/ui";
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

type ScheduleMode = "always" | "scheduled";
type TargetMode = "all" | "selected";

export function MessagesSimplePage() {
  const { organization, user } = useAuth();
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [screens, setScreens] = useState<Screen[]>([]);
  const [editing, setEditing] = useState<MessageRow | null | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!organization) return;
    const [messageResult, screenResult] = await Promise.all([
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

    if (messageResult.error) setError(messageResult.error.message);
    else setMessages((messageResult.data || []) as unknown as MessageRow[]);
    if (screenResult.data) setScreens(screenResult.data as Screen[]);
  }, [organization]);

  useEffect(() => { void load(); }, [load]);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!organization || !user) return;

    setBusy(true);
    setError(null);

    const values = formData(event);
    const raw = new FormData(event.currentTarget);
    const scheduleMode = (values.schedule_mode || "always") as ScheduleMode;
    const targetMode = (values.target_mode || "all") as TargetMode;
    const selectedDays = weekdays.filter(([day]) => raw.has(`day_${day}`)).map(([day]) => day);
    const targets = targetMode === "selected"
      ? screens.filter((screen) => raw.has(`screen_${screen.id}`)).map((screen) => screen.id)
      : [];

    if (scheduleMode === "scheduled" && !selectedDays.length) {
      setBusy(false);
      setError("Escolha pelo menos um dia.");
      return;
    }
    if (targetMode === "selected" && !targets.length) {
      setBusy(false);
      setError("Escolha pelo menos uma tela.");
      return;
    }

    const durationMode = (values.duration_mode || "auto") as MessageDurationMode;
    const payload = {
      organization_id: organization.id,
      title: values.title || null,
      body: values.body,
      starts_at: scheduleMode === "scheduled" && values.starts_at ? new Date(`${values.starts_at}T00:00:00`).toISOString() : null,
      ends_at: scheduleMode === "scheduled" && values.ends_at ? new Date(`${values.ends_at}T23:59:59`).toISOString() : null,
      weekdays: scheduleMode === "always" ? weekdays.map(([day]) => day) : selectedDays,
      start_time: scheduleMode === "always" ? "00:00" : values.start_time || "08:00",
      end_time: scheduleMode === "always" ? "23:59" : values.end_time || "18:00",
      display_location: (values.display_location || "footer") as MessageDisplayLocation,
      priority: (values.priority || "normal") as MessagePriority,
      duration_mode: durationMode,
      duration_seconds: durationMode === "manual" ? Math.max(5, Math.min(120, Number(values.duration_seconds || 12))) : null,
      style_variant: (values.style_variant || "standard") as MessageStyleVariant,
      is_exclusive: raw.has("is_exclusive"),
      is_active: editing ? editing.is_active : true,
      created_by: user.id,
    };

    const result = editing
      ? await supabase.from("messages").update(payload).eq("id", editing.id).select("id").single()
      : await supabase.from("messages").insert(payload).select("id").single();

    if (result.error) {
      setBusy(false);
      setError(result.error.message);
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
      setError(cleared.error?.message || targeted.error?.message || "Não foi possível salvar o destino.");
      return;
    }

    setEditing(undefined);
    await load();
  };

  const toggle = async (message: MessageRow) => {
    const result = await supabase.from("messages").update({ is_active: !message.is_active }).eq("id", message.id);
    if (result.error) setError(result.error.message);
    else await load();
  };

  const remove = async (message: MessageRow) => {
    if (!confirm("Excluir esta mensagem?")) return;
    const result = await supabase.from("messages").delete().eq("id", message.id);
    if (result.error) setError(result.error.message);
    else await load();
  };

  return (
    <>
      <PageHead
        eyebrow="Comunicação"
        title="Mensagens"
        text="Crie avisos para suas telas em poucos passos."
        action="Nova mensagem"
        onAction={() => { setError(null); setEditing(null); }}
      />
      <FormMessage error={error} />

      {messages.length ? (
        <div className="simple-message-grid">
          {messages.map((message) => (
            <article className={`simple-message-card priority-${message.priority}`} key={message.id}>
              <div className="simple-message-top">
                <span className="simple-message-icon"><MessageSquareText /></span>
                <span className={message.is_active ? "status active" : "status offline-status"}>{message.is_active ? "Ativa" : "Pausada"}</span>
              </div>
              <h2>{message.title || "Mensagem"}</h2>
              <p>{message.body}</p>
              <div className="simple-message-meta">
                <span><Monitor /> {locationLabel(message.display_location)}</span>
                <span><Clock3 /> {scheduleLabel(message)}</span>
              </div>
              <small>{targetLabel(message, screens)}</small>
              <div className="simple-message-actions">
                <button className="btn secondary" onClick={() => { setError(null); setEditing(message); }}><Pencil /> Editar</button>
                <button className="icon-button" title={message.is_active ? "Pausar" : "Ativar"} onClick={() => void toggle(message)}>{message.is_active ? <Power /> : <Play />}</button>
                <button className="icon-button danger-hover" title="Excluir" onClick={() => void remove(message)}><Trash2 /></button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<MessageSquareText />}
          title="Nenhuma mensagem"
          text="Crie um aviso e escolha onde ele deve aparecer."
          action="Criar mensagem"
          onAction={() => setEditing(null)}
        />
      )}

      {editing !== undefined && (
        <MessageComposer
          message={editing}
          screens={screens}
          busy={busy}
          error={error}
          onClose={() => { setEditing(undefined); setError(null); }}
          onSubmit={save}
        />
      )}
    </>
  );
}

function MessageComposer({
  message,
  screens,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  message: MessageRow | null;
  screens: Screen[];
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const targeted = new Set(message?.message_screens.map((item) => item.screen_id) || []);
  const initialAlways = !message
    || (!message.starts_at && !message.ends_at && message.weekdays.length === 7 && message.start_time.slice(0, 5) === "00:00" && message.end_time.slice(0, 5) === "23:59");

  const [body, setBody] = useState(message?.body || "");
  const [location, setLocation] = useState<MessageDisplayLocation>(message?.display_location || "footer");
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>(initialAlways ? "always" : "scheduled");
  const [targetMode, setTargetMode] = useState<TargetMode>(targeted.size ? "selected" : "all");
  const [priority, setPriority] = useState<MessagePriority>(message?.priority || "normal");
  const [variant, setVariant] = useState<MessageStyleVariant>(message?.style_variant || "standard");
  const [durationMode, setDurationMode] = useState<MessageDurationMode>(message?.duration_mode || "auto");
  const [duration, setDuration] = useState(message?.duration_seconds || 12);

  return (
    <Modal eyebrow="MENSAGEM" title={message ? "Editar mensagem" : "Nova mensagem"} onClose={onClose}>
      <form className="message-composer" onSubmit={onSubmit}>
        <input type="hidden" name="display_location" value={location} />
        <input type="hidden" name="schedule_mode" value={scheduleMode} />
        <input type="hidden" name="target_mode" value={targetMode} />
        <input type="hidden" name="priority" value={priority} />
        <input type="hidden" name="style_variant" value={variant} />
        <input type="hidden" name="duration_mode" value={durationMode} />

        <label className="message-main-field">
          Mensagem
          <textarea
            name="body"
            rows={4}
            required
            autoFocus
            maxLength={420}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Digite o aviso que aparecerá na TV"
          />
          <small>{body.length}/420</small>
        </label>

        <section className="message-simple-section">
          <b>Onde aparece?</b>
          <div className="message-choice-grid">
            <button type="button" className={location === "footer" ? "selected" : ""} onClick={() => setLocation("footer")}>
              <MessageSquareText /><span><strong>Faixa inferior</strong><small>Discreta e contínua</small></span>{location === "footer" && <Check />}
            </button>
            <button type="button" className={location === "sidebar" ? "selected" : ""} onClick={() => setLocation("sidebar")}>
              <Monitor /><span><strong>Destaque lateral</strong><small>Mais espaço na tela</small></span>{location === "sidebar" && <Check />}
            </button>
          </div>
        </section>

        <section className="message-simple-section">
          <b>Quando?</b>
          <div className="message-segmented">
            <button type="button" className={scheduleMode === "always" ? "selected" : ""} onClick={() => setScheduleMode("always")}>Sempre</button>
            <button type="button" className={scheduleMode === "scheduled" ? "selected" : ""} onClick={() => setScheduleMode("scheduled")}>Definir horário</button>
          </div>
          {scheduleMode === "scheduled" && (
            <div className="message-schedule-box">
              <div className="weekday-picker">
                {weekdays.map(([day, label]) => (
                  <label key={day}>
                    <input type="checkbox" name={`day_${day}`} defaultChecked={!message || message.weekdays.includes(day)} />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
              <div className="form-row">
                <label>Início<input name="start_time" type="time" defaultValue={message?.start_time.slice(0, 5) || "08:00"} /></label>
                <label>Fim<input name="end_time" type="time" defaultValue={message?.end_time.slice(0, 5) || "18:00"} /></label>
              </div>
              <details className="message-date-range">
                <summary>Definir período de datas</summary>
                <div className="form-row">
                  <label>Data inicial<input name="starts_at" type="date" defaultValue={message?.starts_at?.slice(0, 10) || ""} /></label>
                  <label>Data final<input name="ends_at" type="date" defaultValue={message?.ends_at?.slice(0, 10) || ""} /></label>
                </div>
              </details>
            </div>
          )}
        </section>

        <section className="message-simple-section">
          <b>Em quais telas?</b>
          <div className="message-segmented">
            <button type="button" className={targetMode === "all" ? "selected" : ""} onClick={() => setTargetMode("all")}>Todas</button>
            <button type="button" className={targetMode === "selected" ? "selected" : ""} onClick={() => setTargetMode("selected")}>Escolher telas</button>
          </div>
          {targetMode === "selected" && (
            <fieldset className="screen-picker message-screen-picker">
              {screens.length ? screens.map((screen) => (
                <label key={screen.id}>
                  <input type="checkbox" name={`screen_${screen.id}`} defaultChecked={targeted.has(screen.id)} />
                  <span>{screen.name}</span>
                </label>
              )) : <small>Nenhuma tela conectada.</small>}
            </fieldset>
          )}
        </section>

        <MessagePreview body={body} location={location} priority={priority} />

        <details className="message-more-options">
          <summary>Mais opções</summary>
          <div className="message-more-body">
            <label>Título opcional<input name="title" defaultValue={message?.title || ""} maxLength={80} /></label>
            <label>Prioridade
              <select value={priority} onChange={(event) => setPriority(event.target.value as MessagePriority)}>
                <option value="normal">Normal</option>
                <option value="important">Importante</option>
                <option value="urgent">Urgente</option>
              </select>
            </label>
            <label>Estilo
              <select value={variant} onChange={(event) => setVariant(event.target.value as MessageStyleVariant)}>
                <option value="standard">Padrão</option>
                <option value="attention">Atenção</option>
                <option value="info">Informativo</option>
                <option value="success">Positivo</option>
              </select>
            </label>
            <label>Tempo
              <select value={durationMode} onChange={(event) => setDurationMode(event.target.value as MessageDurationMode)}>
                <option value="auto">Automático</option>
                <option value="manual">Definir segundos</option>
              </select>
            </label>
            {durationMode === "manual" && (
              <label>Segundos<input name="duration_seconds" type="number" min={5} max={120} value={duration} onChange={(event) => setDuration(Number(event.target.value))} /></label>
            )}
            {durationMode === "auto" && <input type="hidden" name="duration_seconds" value="" />}
            {location === "sidebar" && (
              <label className="message-exclusive-simple">
                <input type="checkbox" name="is_exclusive" defaultChecked={Boolean(message?.is_exclusive)} />
                <span>Usar o espaço lateral somente para esta mensagem enquanto ela estiver ativa</span>
              </label>
            )}
          </div>
        </details>

        <FormMessage error={error} />
        <div className="modal-actions">
          <button type="button" className="btn secondary" onClick={onClose}>Cancelar</button>
          <AsyncButton busy={busy} className="btn primary">Salvar mensagem</AsyncButton>
        </div>
      </form>
    </Modal>
  );
}

function MessagePreview({ body, location, priority }: { body: string; location: MessageDisplayLocation; priority: MessagePriority }) {
  return (
    <div className={`message-simple-preview ${location} priority-${priority}`}>
      <span>{priority === "urgent" ? <AlertTriangle /> : priority === "important" ? <Info /> : <MessageSquareText />}</span>
      <p>{body || "Sua mensagem aparecerá aqui."}</p>
    </div>
  );
}

function scheduleLabel(message: MessageRow) {
  if (!message.starts_at && !message.ends_at && message.weekdays.length === 7 && message.start_time.slice(0, 5) === "00:00" && message.end_time.slice(0, 5) === "23:59") {
    return "Sempre";
  }
  return `${formatDays(message.weekdays)} · ${message.start_time.slice(0, 5)}–${message.end_time.slice(0, 5)}`;
}

function formatDays(days: number[]) {
  if (days.length === 7) return "Todos os dias";
  if (days.join(",") === "1,2,3,4,5") return "Seg a Sex";
  return weekdays.filter(([day]) => days.includes(day)).map(([, label]) => label).join(", ");
}

function targetLabel(message: MessageRow, screens: Screen[]) {
  const targets = message.message_screens
    .map((item) => screens.find((screen) => screen.id === item.screen_id)?.name)
    .filter(Boolean);
  return targets.length ? targets.join(", ") : "Todas as telas";
}

function locationLabel(location: MessageDisplayLocation) {
  return location === "sidebar" ? "Destaque lateral" : "Faixa inferior";
}
