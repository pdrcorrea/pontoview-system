import { useCallback, useEffect, useState, type FormEvent } from "react";
import { CalendarClock, Power, Trash2 } from "lucide-react";
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
import type { Playlist, Screen } from "../types";

type ScheduleRow = {
  id: string;
  name: string;
  playlist_id: string;
  priority: "default" | "timed" | "campaign";
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  timezone: string;
  playlists: { name: string } | null;
  schedule_rules: Array<{
    id: string;
    screen_id: string | null;
    screen_group_id: string | null;
    weekdays: number[];
    start_time: string;
    end_time: string;
  }>;
};
const weekdayOptions = [
  ["0", "Dom"],
  ["1", "Seg"],
  ["2", "Ter"],
  ["3", "Qua"],
  ["4", "Qui"],
  ["5", "Sex"],
  ["6", "Sáb"],
];

export function SchedulesPage() {
  const { organization, user } = useAuth();
  const [rows, setRows] = useState<ScheduleRow[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [screens, setScreens] = useState<Screen[]>([]);
  const [groups, setGroups] = useState<Array<{ id: string; name: string }>>([]);
  const [modal, setModal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (!organization) return;
    const [s, p, d, g] = await Promise.all([
      supabase
        .from("schedules")
        .select(
          "id,name,playlist_id,priority,starts_at,ends_at,is_active,timezone,playlists(name),schedule_rules(id,screen_id,screen_group_id,weekdays,start_time,end_time)",
        )
        .eq("organization_id", organization.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("playlists")
        .select("*")
        .eq("organization_id", organization.id)
        .order("name"),
      supabase
        .from("screens")
        .select(
          "id,organization_id,name,slug,orientation,default_playlist_id,is_active,settings_revision",
        )
        .eq("organization_id", organization.id)
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("screen_groups")
        .select("id,name")
        .eq("organization_id", organization.id)
        .order("name"),
    ]);
    if (s.error) setError(s.error.message);
    else setRows((s.data || []) as unknown as ScheduleRow[]);
    if (p.data) setPlaylists(p.data as Playlist[]);
    if (d.data) setScreens(d.data as Screen[]);
    if (g.data) setGroups(g.data as Array<{ id: string; name: string }>);
  }, [organization]);
  useEffect(() => {
    void load();
  }, [load]);
  const create = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!organization || !user) return;
    setBusy(true);
    setError(null);
    const data = formData(e);
    const [targetType, targetId] = data.target.split(":", 2);
    const weekdays = weekdayOptions
      .filter(([id]) => new FormData(e.currentTarget).has(`day_${id}`))
      .map(([id]) => Number(id));
    const schedule = await supabase
      .from("schedules")
      .insert({
        organization_id: organization.id,
        name: data.name,
        playlist_id: data.playlist_id,
        priority: data.priority,
        starts_at: data.starts_at
          ? new Date(data.starts_at).toISOString()
          : null,
        ends_at: data.ends_at ? new Date(data.ends_at).toISOString() : null,
        timezone: organization.timezone,
        is_active: true,
        created_by: user.id,
      })
      .select()
      .single();
    let ruleError: string | null = null;
    if (!schedule.error) {
      const rule = await supabase.from("schedule_rules").insert({
        organization_id: organization.id,
        schedule_id: schedule.data.id,
        screen_id: targetType === "screen" ? targetId : null,
        screen_group_id: targetType === "group" ? targetId : null,
        weekdays: weekdays.length ? weekdays : [0, 1, 2, 3, 4, 5, 6],
        start_time: data.start_time || "00:00",
        end_time: data.end_time || "23:59",
      });
      if (rule.error) {
        ruleError = rule.error.message;
        setError(rule.error.message);
      }
    } else setError(schedule.error.message);
    setBusy(false);
    if (!schedule.error && !ruleError) {
      setModal(false);
      await load();
    }
  };
  const toggle = async (row: ScheduleRow) => {
    const result = await supabase
      .from("schedules")
      .update({ is_active: !row.is_active })
      .eq("id", row.id);
    if (result.error) setError(result.error.message);
    else await load();
  };
  const remove = async (row: ScheduleRow) => {
    if (!confirm(`Excluir “${row.name}”?`)) return;
    const result = await supabase.from("schedules").delete().eq("id", row.id);
    if (result.error) setError(result.error.message);
    else await load();
  };
  return (
    <>
      <PageHead
        eyebrow="Automação"
        title="Programação"
        text="Campanhas temporárias têm prioridade sobre horários e playlists padrão."
        action="Nova programação"
        onAction={() => setModal(true)}
      />
      <FormMessage error={error} />
      {rows.length ? (
        <div className="schedule-grid">
          {rows.map((row) => {
            const rule = row.schedule_rules?.[0];
            return (
              <article className="panel" key={row.id}>
                <div className="schedule-actions">
                  <span
                    className={
                      row.is_active ? "status active" : "status offline-status"
                    }
                  >
                    {row.is_active ? "Ativa" : "Pausada"}
                  </span>
                  <button
                    className="icon-button"
                    title={row.is_active ? "Pausar" : "Ativar"}
                    onClick={() => void toggle(row)}
                  >
                    <Power />
                  </button>
                  <button
                    className="icon-button danger-hover"
                    title="Excluir"
                    onClick={() => void remove(row)}
                  >
                    <Trash2 />
                  </button>
                </div>
                <h2>{row.name}</h2>
                <p>
                  {row.playlists?.name || "Playlist"} ·{" "}
                  {priorityLabel(row.priority)}
                </p>
                <strong>
                  {rule?.start_time?.slice(0, 5) || "00:00"} <span>→</span>{" "}
                  {rule?.end_time?.slice(0, 5) || "23:59"}
                </strong>
                <small>
                  {formatWeekdays(rule?.weekdays)}
                  {rule?.screen_id
                    ? ` · ${screens.find((screen) => screen.id === rule.screen_id)?.name || "Tela"}`
                    : rule?.screen_group_id
                      ? ` · ${groups.find((group) => group.id === rule.screen_group_id)?.name || "Grupo"}`
                      : ""}
                  {row.starts_at
                    ? ` · ${new Date(row.starts_at).toLocaleDateString("pt-BR")}`
                    : ""}
                  {row.ends_at
                    ? ` até ${new Date(row.ends_at).toLocaleDateString("pt-BR")}`
                    : ""}
                </small>
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={<CalendarClock />}
          title="Nenhuma programação criada"
          text="Defina quando uma playlist deve aparecer em cada tela."
          action="Nova programação"
          onAction={() => setModal(true)}
        />
      )}
      {modal && (
        <Modal
          eyebrow="NOVA PROGRAMAÇÃO"
          title="Quando e onde exibir"
          onClose={() => setModal(false)}
        >
          <form className="youtube-form schedule-form" onSubmit={create}>
            <label>
              Nome
              <input name="name" required />
            </label>
            <div className="form-row">
              <label>
                Playlist
                <select name="playlist_id" required>
                  <option value="">Selecione…</option>
                  {playlists.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Tela ou grupo
                <select name="target" required>
                  <option value="">Selecione…</option>
                  {screens.map((s) => (
                    <option key={s.id} value={`screen:${s.id}`}>
                      Tela · {s.name}
                    </option>
                  ))}
                  {groups.map((group) => (
                    <option key={group.id} value={`group:${group.id}`}>
                      Grupo · {group.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              Prioridade
              <select name="priority" defaultValue="timed">
                <option value="default">Padrão</option>
                <option value="timed">Por horário</option>
                <option value="campaign">Campanha temporária</option>
              </select>
            </label>
            <div className="weekday-picker">
              {weekdayOptions.map(([id, label]) => (
                <label key={id}>
                  <input type="checkbox" name={`day_${id}`} defaultChecked />
                  <span>{label}</span>
                </label>
              ))}
            </div>
            <div className="form-row">
              <label>
                Horário inicial
                <input
                  name="start_time"
                  type="time"
                  defaultValue="00:00"
                  required
                />
              </label>
              <label>
                Horário final
                <input
                  name="end_time"
                  type="time"
                  defaultValue="23:59"
                  required
                />
              </label>
            </div>
            <div className="form-row">
              <label>
                Data inicial <span>(opcional)</span>
                <input name="starts_at" type="datetime-local" />
              </label>
              <label>
                Data final <span>(opcional)</span>
                <input name="ends_at" type="datetime-local" />
              </label>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn secondary"
                onClick={() => setModal(false)}
              >
                Cancelar
              </button>
              <AsyncButton busy={busy} className="btn primary">
                Criar programação
              </AsyncButton>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
function priorityLabel(value: string) {
  return value === "campaign"
    ? "Campanha"
    : value === "timed"
      ? "Horário"
      : "Padrão";
}
function formatWeekdays(days?: number[]) {
  if (!days || days.length === 7) return "Todos os dias";
  if (days.join(",") === "1,2,3,4,5") return "Seg a Sex";
  return days
    .map((day) => weekdayOptions.find(([id]) => Number(id) === day)?.[1])
    .join(", ");
}
