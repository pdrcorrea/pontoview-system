import { useEffect, useState } from "react";
import { Check, ListPlus, Search } from "lucide-react";
import { AsyncButton, FormMessage, Modal } from "./ui";
import { supabase } from "../lib/supabase";
import type { Media, Playlist } from "../types";
import "./add-to-playlist.css";

type PlaylistChoice = { playlist: Playlist; hasItem: boolean };

type PlaylistMedia = Pick<Media, "id" | "name" | "type" | "duration_seconds">;

export function AddToPlaylist({ media, mediaItems, organizationId, onClose, onSuccess }: {
  media?: PlaylistMedia;
  mediaItems?: PlaylistMedia[];
  organizationId: string;
  onClose: () => void;
  onSuccess: (names: string[]) => void;
}) {
  const files = mediaItems || (media ? [media] : []);
  const fileIds = files.map((file) => file.id);
  const [choices, setChoices] = useState<PlaylistChoice[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageDuration, setImageDuration] = useState(15);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      const playlists = await supabase.from("playlists").select("*").eq("organization_id", organizationId).order("name");
      if (playlists.error) { if (active) setError(playlists.error.message); return; }
      const ids = (playlists.data || []).map((p) => p.id);
      const memberships = ids.length && fileIds.length
        ? await supabase.from("playlist_items").select("playlist_id,media_id").in("media_id", fileIds).in("playlist_id", ids)
        : { data: [], error: null };
      if (!active) return;
      if (memberships.error) setError(memberships.error.message);
      else {
        const existingCounts = new Map<string, Set<string>>();
        for (const row of memberships.data || []) {
          const mediaSet = existingCounts.get(row.playlist_id) || new Set<string>();
          mediaSet.add(row.media_id);
          existingCounts.set(row.playlist_id, mediaSet);
        }
        const existing = new Set(ids.filter((id) => existingCounts.get(id)?.size === fileIds.length));
        setChoices((playlists.data || []).map((playlist) => ({ playlist: playlist as Playlist, hasItem: existing.has(playlist.id) })));
      }
      setLoading(false);
    };
    void load();
    return () => { active = false; };
  }, [organizationId, fileIds.join(",")]);

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
          supabase.from("media").select("id,status").in("id", fileIds).eq("organization_id", organizationId),
        ]);
        if (current.error) throw current.error;
        if (available.error || available.data?.length !== fileIds.length || available.data.some((row) => row.status !== "ready")) throw new Error("Um dos conteúdos não está disponível na biblioteca.");
        const already = new Set((current.data || []).map((row) => row.media_id));
        const newFiles = files.filter((file) => !already.has(file.id));
        if (!newFiles.length) continue;
        const items = [...(current.data || []).map((row) => ({ mediaId: row.media_id, durationSeconds: row.duration_seconds, settings: row.settings || {} })), ...newFiles.map((file) => ({ mediaId: file.id, durationSeconds: file.type === "drive_image" ? imageDuration : file.duration_seconds ?? (["webpage", "app", "message"].includes(file.type) ? 30 : null), settings: {} }))];
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
      <p className="playlist-quick-name">{files.length === 1 ? files[0].name : `${files.length} conteúdos adicionados à biblioteca`}</p>
      {files.some((file) => file.type === "drive_image") && <label className="playlist-quick-duration">Tempo de exibição das imagens <select value={imageDuration} onChange={(event) => setImageDuration(Number(event.target.value))}><option value={5}>5 segundos</option><option value={10}>10 segundos</option><option value={15}>15 segundos</option><option value={30}>30 segundos</option><option value={60}>60 segundos</option></select></label>}
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
      <div className="modal-actions"><button type="button" className="btn secondary" onClick={onClose} disabled={saving}>Agora não</button><AsyncButton busy={saving} disabled={loading || !selected.length} className="btn primary" onClick={() => void save()}><ListPlus size={17} /> Adicionar às playlists</AsyncButton></div>
    </div>
  </Modal>;
}
