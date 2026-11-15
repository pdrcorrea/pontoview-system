import { useEffect, useState } from "react";
import { Check, ListPlus, Search } from "lucide-react";
import { AsyncButton, FormMessage, Modal } from "./ui";
import { supabase } from "../lib/supabase";
import type { Media, Playlist } from "../types";
import "./add-to-playlist.css";

type PlaylistChoice = { playlist: Playlist; hasItem: boolean };

export function AddToPlaylist({ media, organizationId, onClose, onSuccess }: {
  media: Pick<Media, "id" | "name" | "type" | "duration_seconds">;
  organizationId: string;
  onClose: () => void;
  onSuccess: (names: string[]) => void;
}) {
  const [choices, setChoices] = useState<PlaylistChoice[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      const playlists = await supabase.from("playlists").select("*").eq("organization_id", organizationId).order("name");
      if (playlists.error) { if (active) setError(playlists.error.message); return; }
      const ids = (playlists.data || []).map((p) => p.id);
      const memberships = ids.length
        ? await supabase.from("playlist_items").select("playlist_id").eq("media_id", media.id).in("playlist_id", ids)
        : { data: [], error: null };
      if (!active) return;
      if (memberships.error) setError(memberships.error.message);
      else {
        const existing = new Set((memberships.data || []).map((row) => row.playlist_id));
        setChoices((playlists.data || []).map((playlist) => ({ playlist: playlist as Playlist, hasItem: existing.has(playlist.id) })));
      }
      setLoading(false);
    };
    void load();
    return () => { active = false; };
  }, [organizationId, media.id]);

  const save = async () => {
    if (!selected.length || saving) return;
    setSaving(true);
    setError(null);
    const completed: string[] = [];
    try {
      // Use the same operation as the playlist editor; preserve ordering, duration and settings.
      for (const id of selected) {
        const playlist = choices.find((choice) => choice.playlist.id === id)?.playlist;
        if (!playlist) continue;
        const [current, available] = await Promise.all([
          supabase.from("playlist_items").select("media_id,duration_seconds,settings").eq("playlist_id", id).order("position"),
          supabase.from("media").select("id,status").eq("id", media.id).eq("organization_id", organizationId).single(),
        ]);
        if (current.error) throw current.error;
        if (available.error || available.data?.status !== "ready") throw new Error("Este conteúdo não está disponível na biblioteca.");
        if ((current.data || []).some((row) => row.media_id === media.id)) continue;
        const duration = media.duration_seconds ?? (media.type === "drive_image" ? 15 : ["webpage", "app", "message"].includes(media.type) ? 30 : null);
        const items = [...(current.data || []).map((row) => ({ mediaId: row.media_id, durationSeconds: row.duration_seconds, settings: row.settings || {} })), { mediaId: media.id, durationSeconds: duration, settings: {} }];
        const result = await supabase.rpc("replace_playlist_items", { p_playlist_id: id, p_items: items });
        if (result.error) throw result.error;
        completed.push(playlist.name);
      }
      onSuccess(completed);
      onClose();
    } catch (cause) {
      setError(`${cause instanceof Error ? cause.message : "Não foi possível salvar."}${completed.length ? ` Adicionado a: ${completed.join(", ")}.` : ""}`);
      setChoices((previous) => previous.map((choice) => ({ ...choice, hasItem: choice.hasItem || completed.includes(choice.playlist.name) })));
      setSelected((previous) => previous.filter((id) => !completed.includes(choices.find((choice) => choice.playlist.id === id)?.playlist.name || "")));
    } finally { setSaving(false); }
  };

  return <Modal eyebrow="PLAYLISTS" title="Adicionar à playlist" onClose={onClose}>
    <div className="playlist-quick-add">
      <p className="playlist-quick-name">{media.name}</p>
      <label className="inline-search"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar playlist" /></label>
      <FormMessage error={error} />
      {loading ? <p>Carregando playlists…</p> : choices.length === 0 ? <p>Nenhuma playlist cadastrada. Crie uma na página Playlists.</p> :
        <div className="playlist-quick-list">
          {choices.filter(({ playlist }) => playlist.name.toLowerCase().includes(search.toLowerCase())).map(({ playlist, hasItem }) =>
            <label key={playlist.id} className={`playlist-quick-choice ${hasItem ? "already-added" : ""}`}>
              <input type="checkbox" disabled={hasItem || saving} checked={hasItem || selected.includes(playlist.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, playlist.id] : current.filter((id) => id !== playlist.id))} />
              <span>{playlist.name}</span>{hasItem && <small><Check size={14} /> Já adicionado</small>}
            </label>)}
        </div>}
      <div className="modal-actions"><button type="button" className="btn secondary" onClick={onClose} disabled={saving}>Cancelar</button><AsyncButton busy={saving} disabled={loading || !selected.length} className="btn primary" onClick={() => void save()}><ListPlus size={17} /> Adicionar</AsyncButton></div>
    </div>
  </Modal>;
}
