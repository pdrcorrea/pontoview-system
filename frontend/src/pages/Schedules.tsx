import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  CalendarClock,
  Clock3,
  Pencil,
  Play,
  Power,
  PowerOff,
  Trash2,
} from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import {
  AsyncButton,
  EmptyState,
  FormMessage,
  Modal,
  PageHead,
  formData,
} from "../components/ui";
import {
  defaultOperatingHours,
  isWithinOperatingHours,
  normalizeOperatingHours,
  operatingHoursSummary,
} from "../lib/operatingHours";
import { supabase } from "../lib/supabase";
import type { OperatingHours, Playlist, Screen, ScreenSettings } from "../types";

type ScheduleRule = {
  id: string;
  screen_id: string | null;
  screen_group_id: string | null;
  weekdays: number[];
  start_time: string;
  end_time: string;
};

type ScheduleRow = {
  id: string;
  organization_id: string;
  name: string;
  playlist_id: string;
  priority: "default" | "timed" | "campaign";
  starts_at: string | null;
  ends_at: string | null;
  timezone: string;
  is_active: boolean;
  playlists?: { name: string } | null;
  schedule_rules?: ScheduleRule[];
};

type Group = { id: string; name: string };
type ScreenWithSettings = Screen & { screen_settings?: ScreenSettings | ScreenSettings[] | null };

const priorityLabel = { default: "Padrão", timed: "Por horário", campaign: "Campanha" };
const weekdayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function SchedulesPage() {
  const { organization, user } = useAuth();
  const [rows, setRows] = useState<ScheduleRow[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [screens, setScreens] = useState<ScreenWithSettings[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<ScheduleRow | null>(null);
  const [operatingScreen, setOperatingScreen] = useState<ScreenWithSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());

  const load = useCallback(async () => {
    if (!organization) return;
    const [schedules, p, s, g] = await Promise.all([
      supabase
        .from("schedules")
        .select("id,organization_id,name,playlist_id,priority,starts_at,ends_at,timezone,is_active,playlists(name),schedule_rules(id,screen_id,screen_group_id,weekdays,start_time,end_time)")
        .eq("organization_id", organization.id)
        .order("created_at", { ascending: false }),
      supabase.from("playlists").select("*").eq("organization_id", organization.id).order("name"),
      supabase
        .from("screens")
        .select("id,organization_id,name,slug,orientation,default_playlist_id,is_active,settings_revision,screen_settings(*)")
        .eq("organization_id", organization.id)
        .eq("is_active", true)
        .order("name"),
      supabase.from("screen_groups").select("id,name").eq("organization_id", organization.id).order("name"),
    ]);
    if (schedules.error) setError(schedules.error.message);
    else setRows((schedules.data || []) as unknown as ScheduleRow[]);
    if (p.data) setPlaylists(p.data as Playlist[]);
    if (s.data) setScreens((s.data || []) as unknown as ScreenWithSettings[]);
    if (g.data) setGroups(g.data as Group[]);
  }, [organization]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const openNew = () => { setEditing(null); setError(null); setModal(true); };
  const openEdit = (row: ScheduleRow) => { setEditing(row); setError(null); setModal(true); };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!organization || !user) return;
    setBusy(true);
    setError(null);
    const data = formData(event);
    const raw = new FormData(event.currentTarget);
    const weekdays = weekdayNames.map((_, i) => i).filter((i) => raw.has(`day_${i}`));
    if (!weekdays.length) {
      setBusy(false);
      setError("Selecione pelo menos um dia da semana.");
      return;
    }
    const target = data.target || "";
    const [targetType, targetId] = target.split(":");
    if (!targetId || !["screen", "group"].includes(targetType)) {
      setBusy(false);
      setError("Selecione a tela ou grupo que receberá a programação.");
      return;
    }
    const payload = {
      organization_id: organization.id,
      name: data.name,
      playlist_id: data.playlist_id,
      priority: data.priority || "timed",
      starts_at: data.starts_at ? new Date(`${data.starts_at}T00:00:00`).toISOString() : null,
      ends_at: data.ends_at ? new Date(`${data.ends_at}T23:59:59`).toISOString() : null,
      timezone: organization.timezone || "America/Sao_Paulo",
      is_active: true,
      created_by: user.id,
    };
    let scheduleId = editing?.id || "";
    if (editing) {
      const result = await supabase.from("schedules").update(payload).eq("id", editing.id);
      if (result.error) { setBusy(false); setError(result.error.message); return; }
      await supabase.from("schedule_rules").delete().eq("schedule_id", editing.id);
    } else {
      const result = await supabase.from("schedules").insert(payload).select("id").single();
      if (result.error) { setBusy(false); setError(result.error.message); return; }
      scheduleId = result.data.id;
    }
    const rule = await supabase.from("schedule_rules").insert({
      organization_id: organization.id,
      schedule_id: scheduleId,
      screen_id: targetType === "screen" ? targetId : null,
      screen_group_id: targetType === "group" ? targetId : null,
      weekdays,
      start_time: data.start_time || "00:00",
      end_time: data.end_time || "23:59",
    });
    setBusy(false);
    if (rule.error) setError(rule.error.message);
    else { setModal(false); setEditing(null); await load(); }
  };

  const remove = async (row: ScheduleRow) => {
    if (!confirm(`Excluir a programação “${row.name}”?`)) return;
    const result = await supabase.from("schedules").delete().eq("id", row.id);
    if (result.error) setError(result.error.message);
    else await load();
  };

  const toggleActive = async (row: ScheduleRow) => {
    const result = await supabase.from("schedules").update({ is_active: !row.is_active }).eq("id", row.id);
    if (result.error) setError(result.error.message);
    else await load();
  };

  const saveOperatingHours = async (value: OperatingHours) => {
    if (!operatingScreen) return;
    setBusy(true);
    setError(null);
    const normalized = normalizeOperatingHours(value);
    const [settingsResult, screenResult] = await Promise.all([
      supabase.from("screen_settings").update({ operating_hours: normalized }).eq("screen_id", operatingScreen.id),
      supabase.from("screens").update({ settings_revision: operatingScreen.settings_revision + 1 }).eq("id", operatingScreen.id),
    ]);
    setBusy(false);
    if (settingsResult.error || screenResult.error) {
      setError(settingsResult.error?.message || screenResult.error?.message || "Não foi possível salvar o funcionamento.");
      return;
    }
    setOperatingScreen(null);
    await load();
  };

  return (
    <>
      <PageHead
        eyebrow="Automação"
        title="Programação"
        text="Defina qual conteúdo aparece em cada tela e em quais horários as telas devem operar."
        action="Nova programação"
        onAction={openNew}
      />
      <FormMessage error={!modal && !operatingScreen ? error : null} />

      <section className="panel" style={{ marginBottom: 22 }}>
        <div className="panel-title">
          <div>
            <h2>Funcionamento das telas</h2>
            <p>Fora do horário definido, o Player entra em repouso com imagem 100% preta.</p>
          </div>
          <Power size={20} />
        </div>
        {screens.length ? (
          <div className="list-panel" style={{ marginTop: 14 }}>
            {screens.map((screen) => {
              const settings = firstSettings(screen);
              const hours = normalizeOperatingHours(settings?.operating_hours);
              const running = isWithinOperatingHours(hours, organization?.timezone || "America/Sao_Paulo", now);
              return (
                <article className="playlist-row" key={screen.id}>
                  <span className="playlist-icon">{running ? <Power size={17} /> : <PowerOff size={17} />}</span>
                  <span className="grow">
                    <b>{screen.name}</b>
                    <small>{operatingHoursSummary(hours)}</small>
                  </span>
                  <span className={running ? "status active" : "status scheduled"}>{hours.enabled ? (running ? "Ligada agora" : "Em repouso") : "Sempre ligada"}</span>
                  <button className="btn tertiary" onClick={() => setOperatingScreen(screen)}>Configurar</button>
                </article>
              );
            })}
          </div>
        ) : <small>Nenhuma tela conectada.</small>}
        <div className="info-box" style={{ marginTop: 14 }}>
          <PowerOff size={18} />
          <span><b>Modo repouso</b><small>A tela preta interrompe a exibição e evita luminosidade desnecessária. O Player continua conectado para receber novas configurações e voltar automaticamente no horário programado.</small></span>
        </div>
      </section>

      <div className="panel-title" style={{ marginTop: 28 }}>
        <div><h2>Programações de conteúdo</h2><p>Campanhas têm prioridade sobre horários, que têm prioridade sobre a playlist padrão.</p></div>
      </div>

      {rows.length ? (
        <div className="schedule-grid">
          {rows.map((row) => {
            const activeNow = scheduleMatchesNow(row, now);
            const rule = row.schedule_rules?.[0];
            const targetName = rule?.screen_id
              ? screens.find((screen) => screen.id === rule.screen_id)?.name || "Tela"
              : groups.find((group) => group.id === rule?.screen_group_id)?.name || "Grupo";
            const sameAsDefault = Boolean(rule?.screen_id && screens.find((screen) => screen.id === rule.screen_id)?.default_playlist_id === row.playlist_id);
            return (
              <article className="panel schedule-card" key={row.id}>
                <span className={activeNow ? "status active" : row.is_active ? "status scheduled" : "status offline-status"}>
                  {activeNow ? "Em exibição agora" : row.is_active ? "Ativa" : "Pausada"}
                </span>
                <h2>{row.name}</h2>
                <p>{row.playlists?.name || "Playlist"} · {targetName}</p>
                <strong>{priorityLabel[row.priority]}</strong>
                <div className="schedule-meta">
                  <span><CalendarClock /> {scheduleDays(row)}</span>
                  <span><Clock3 /> {formatRuleTime(rule)}</span>
                </div>
                {sameAsDefault && (
                  <small style={{ display: "block", marginTop: 10, lineHeight: 1.45 }}>
                    Esta regra usa a mesma playlist padrão da tela. Ela está funcionando, mas visualmente o conteúdo permanece igual fora do horário.
                  </small>
                )}
                <div className="schedule-actions">
                  <button className="icon-button" title={row.is_active ? "Pausar" : "Ativar"} onClick={() => void toggleActive(row)}>{row.is_active ? <PowerOff /> : <Play />}</button>
                  <button className="icon-button" title="Editar" onClick={() => openEdit(row)}><Pencil /></button>
                  <button className="icon-button danger-hover" title="Excluir" onClick={() => void remove(row)}><Trash2 /></button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState icon={<CalendarClock />} title="Nenhuma programação criada" text="A playlist padrão continua funcionando normalmente. Crie uma regra para trocar conteúdo por horário ou campanha." action="Criar primeira programação" onAction={openNew} />
      )}

      {modal && (
        <ScheduleModal
          row={editing}
          playlists={playlists}
          screens={screens}
          groups={groups}
          busy={busy}
          error={error}
          onSubmit={save}
          onClose={() => { setModal(false); setEditing(null); setError(null); }}
        />
      )}

      {operatingScreen && (
        <OperatingHoursModal
          screen={operatingScreen}
          busy={busy}
          error={error}
          onClose={() => { setOperatingScreen(null); setError(null); }}
          onSave={saveOperatingHours}
        />
      )}
    </>
  );
}

function ScheduleModal({ row, playlists, screens, groups, busy, error, onSubmit, onClose }: {
  row: ScheduleRow | null;
  playlists: Playlist[];
  screens: ScreenWithSettings[];
  groups: Group[];
  busy: boolean;
  error: string | null;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
}) {
  const rule = row?.schedule_rules?.[0];
  const defaultTarget = rule?.screen_id ? `screen:${rule.screen_id}` : rule?.screen_group_id ? `group:${rule.screen_group_id}` : "";
  const selectedDays = rule?.weekdays || [1, 2, 3, 4, 5];
  return (
    <Modal eyebrow="PROGRAMAÇÃO DE CONTEÚDO" title={row ? "Editar programação" : "Nova programação"} onClose={onClose}>
      <form className="youtube-form" onSubmit={onSubmit}>
        <label>Nome<input name="name" required defaultValue={row?.name || ""} placeholder="Ex.: Horário de almoço" /></label>
        <div className="form-row">
          <label>Playlist<select name="playlist_id" required defaultValue={row?.playlist_id || ""}><option value="">Selecione</option>{playlists.map((playlist) => <option key={playlist.id} value={playlist.id}>{playlist.name}</option>)}</select></label>
          <label>Prioridade<select name="priority" defaultValue={row?.priority || "timed"}><option value="default">Padrão</option><option value="timed">Por horário</option><option value="campaign">Campanha</option></select></label>
        </div>
        <label>Destino<select name="target" required defaultValue={defaultTarget}><option value="">Selecione</option><optgroup label="Telas">{screens.map((screen) => <option key={screen.id} value={`screen:${screen.id}`}>{screen.name}</option>)}</optgroup>{groups.length > 0 && <optgroup label="Grupos">{groups.map((group) => <option key={group.id} value={`group:${group.id}`}>{group.name}</option>)}</optgroup>}</select></label>
        <fieldset className="screen-picker"><legend>Dias da semana</legend><div className="weekday-picker">{weekdayNames.map((name, index) => <label key={name}><input type="checkbox" name={`day_${index}`} defaultChecked={selectedDays.includes(index)} /><span>{name}</span></label>)}</div></fieldset>
        <div className="form-row">
          <label>Início<input name="start_time" type="time" defaultValue={String(rule?.start_time || "00:00").slice(0, 5)} required /></label>
          <label>Fim<input name="end_time" type="time" defaultValue={String(rule?.end_time || "23:59").slice(0, 5)} required /></label>
        </div>
        <div className="form-row">
          <label>Data inicial <span>(opcional)</span><input name="starts_at" type="date" defaultValue={row?.starts_at?.slice(0, 10) || ""} /></label>
          <label>Data final <span>(opcional)</span><input name="ends_at" type="date" defaultValue={row?.ends_at?.slice(0, 10) || ""} /></label>
        </div>
        <FormMessage error={error} />
        <div className="modal-actions"><button type="button" className="btn secondary" onClick={onClose}>Cancelar</button><AsyncButton busy={busy} className="btn primary">Salvar programação</AsyncButton></div>
      </form>
    </Modal>
  );
}

function OperatingHoursModal({ screen, busy, error, onClose, onSave }: {
  screen: ScreenWithSettings;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (value: OperatingHours) => void;
}) {
  const initial = normalizeOperatingHours(firstSettings(screen)?.operating_hours || defaultOperatingHours);
  const [enabled, setEnabled] = useState(initial.enabled);
  const [days, setDays] = useState(initial.weekdays);
  const [start, setStart] = useState(initial.start);
  const [end, setEnd] = useState(initial.end);
  const toggleDay = (day: number) => setDays((value) => value.includes(day) ? value.filter((item) => item !== day) : [...value, day].sort((a, b) => a - b));
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (enabled && !days.length) return;
    onSave({ enabled, weekdays: days.length ? days : defaultOperatingHours.weekdays, start, end });
  };
  return (
    <Modal eyebrow="FUNCIONAMENTO DA TELA" title={screen.name} onClose={onClose}>
      <form className="youtube-form" onSubmit={submit}>
        <label className="checkbox-row"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} /><span><b>Usar horário de funcionamento</b><small>Fora desse período o Player fica totalmente preto.</small></span></label>
        {enabled && (
          <>
            <fieldset className="screen-picker"><legend>Dias em funcionamento</legend><div className="weekday-picker">{weekdayNames.map((name, index) => <label key={name}><input type="checkbox" checked={days.includes(index)} onChange={() => toggleDay(index)} /><span>{name}</span></label>)}</div></fieldset>
            <div className="form-row"><label>Ligar às<input type="time" value={start} onChange={(event) => setStart(event.target.value)} required /></label><label>Entrar em repouso às<input type="time" value={end} onChange={(event) => setEnd(event.target.value)} required /></label></div>
            <div className="info-box"><PowerOff /><span><b>Horários que atravessam a meia-noite são aceitos</b><small>Ex.: 18:00 → 02:00 mantém a tela ativa até 02:00 do dia seguinte.</small></span></div>
          </>
        )}
        <FormMessage error={enabled && !days.length ? "Selecione pelo menos um dia de funcionamento." : error} />
        <div className="modal-actions"><button type="button" className="btn secondary" onClick={onClose}>Cancelar</button><AsyncButton busy={busy} className="btn primary">Salvar funcionamento</AsyncButton></div>
      </form>
    </Modal>
  );
}

function firstSettings(screen: ScreenWithSettings) {
  const raw = screen.screen_settings;
  return (Array.isArray(raw) ? raw[0] : raw) as ScreenSettings | undefined;
}

function scheduleMatchesNow(row: ScheduleRow, now: Date) {
  if (!row.is_active) return false;
  if (row.starts_at && now < new Date(row.starts_at)) return false;
  if (row.ends_at && now >= new Date(row.ends_at)) return false;
  const rule = row.schedule_rules?.[0];
  if (!rule) return false;
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: row.timezone || "America/Sao_Paulo", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.find((p) => p.type === "weekday")?.value || "Sun");
  const minute = Number(parts.find((p) => p.type === "hour")?.value || 0) * 60 + Number(parts.find((p) => p.type === "minute")?.value || 0);
  const start = toMinutes(rule.start_time);
  const end = toMinutes(rule.end_time);
  if (start <= end) return rule.weekdays.includes(weekday) && minute >= start && minute <= end;
  if (minute >= start) return rule.weekdays.includes(weekday);
  return minute <= end && rule.weekdays.includes((weekday + 6) % 7);
}

function toMinutes(value: string) {
  const [hour, minute] = String(value || "00:00").split(":").map(Number);
  return hour * 60 + minute;
}

function scheduleDays(row: ScheduleRow) {
  const days = row.schedule_rules?.[0]?.weekdays || [];
  if (days.length === 7) return "Todos os dias";
  if (days.join(",") === "1,2,3,4,5") return "Seg a Sex";
  return days.map((day) => weekdayNames[day]).join(", ") || "Sem dias";
}

function formatRuleTime(rule?: ScheduleRule) {
  if (!rule) return "Sem horário";
  return `${String(rule.start_time).slice(0, 5)} → ${String(rule.end_time).slice(0, 5)}`;
}
