import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff, Check, Monitor, Sparkles, TriangleAlert } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { supabase } from "../lib/supabase";
import { SEASONAL_CAMPAIGNS, isSeasonalCampaignActive } from "../seasonalCampaigns";

type Notice = { id: string; title: string; body: string; href: string; type: "seasonal" | "offline" | "reconnected" | "error" };
type Preferences = { seasonal: boolean; offline: boolean; errors: boolean; recovered: boolean; desktop: boolean };
const defaults: Preferences = { seasonal: true, offline: true, errors: true, recovered: true, desktop: false };

export function NotificationCenter() {
  const { organization, user } = useAuth();
  const navigate = useNavigate();
  const key = `pv:notification-settings:${user?.id || "guest"}`;
  const [prefs, setPrefs] = useState<Preferences>(() => {
    try { return { ...defaults, ...JSON.parse(localStorage.getItem(key) || "{}") }; } catch { return defaults; }
  });
  const [open, setOpen] = useState(false);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [seen, setSeen] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(`pv:notification-seen:${user?.id || "guest"}`) || "[]"); } catch { return []; }
  });
  const [permissionMessage, setPermissionMessage] = useState("");

  useEffect(() => { localStorage.setItem(key, JSON.stringify(prefs)); }, [key, prefs]);
  useEffect(() => {
    if (!user || !prefs.desktop) return;
    void (async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration("/push-sw.js");
        const sub = await reg?.pushManager.getSubscription();
        if (sub) await supabase.from("push_subscriptions").update({
          notify_seasonal: prefs.seasonal, notify_offline: prefs.offline,
          notify_errors: prefs.errors, notify_recovered: prefs.recovered,
        }).eq("endpoint", sub.endpoint).eq("user_id", user.id);
      } catch { /* Mantém a preferência local se o navegador não suportar. */ }
    })();
  }, [user?.id, prefs.desktop, prefs.seasonal, prefs.offline, prefs.errors, prefs.recovered]);
  const seenKey = `pv:notification-seen:${user?.id || "guest"}`;
  useEffect(() => { try { localStorage.setItem(seenKey, JSON.stringify(seen.slice(-200))); } catch {} }, [seen, seenKey]);

  const load = useCallback(async () => {
    if (!organization) return;
    const now = Date.now();
    const next: Notice[] = [];
    if (prefs.seasonal) {
      const year = new Date().getFullYear();
      for (const campaign of SEASONAL_CAMPAIGNS) {
        if (isSeasonalCampaignActive(campaign, new Date(), organization.timezone)) {
          next.push({
            id: `seasonal:${year}:${campaign.key}`,
            title: `${campaign.emoji} ${campaign.name} disponível`,
            body: "O painel sazonal está no período de exibição e pode ser adicionado à playlist.",
            href: "/apps",
            type: "seasonal",
          });
        }
      }
    }
    const [screens, events] = await Promise.all([
      supabase.from("screens").select("id,name,screen_status(last_seen)").eq("organization_id", organization.id).eq("is_active", true),
      supabase.from("screen_events").select("screen_id,media_id,event_type,payload,occurred_at,media(name),screens(name)")
        .eq("organization_id", organization.id).in("event_type", ["media_error", "content_ended"])
        .gte("occurred_at", new Date(now - 24 * 60 * 60 * 1000).toISOString())
        .order("occurred_at", { ascending: false }).limit(150),
    ]);
    if (!screens.error) for (const screen of screens.data || []) {
      const raw = screen.screen_status as { last_seen?: string } | { last_seen?: string }[] | null;
      const status = Array.isArray(raw) ? raw[0] : raw;
      const last = status?.last_seen ? new Date(status.last_seen).getTime() : 0;
      if (prefs.offline && last && now - last > 5 * 60_000) next.push({
        id: `offline:${screen.id}:${Math.floor(last / (5 * 60_000))}`,
        title: `TV desconectada: ${screen.name}`, body: "Sem comunicação há mais de 5 minutos.",
        href: "/telas", type: "offline",
      });
    }
    if (!events.error) {
      const latest = new Set<string>();
      for (const raw of events.data || []) {
        const event = raw as unknown as { screen_id: string; media_id: string | null; event_type: string; occurred_at: string; media: { name: string } | { name: string }[] | null; screens: { name: string } | { name: string }[] | null };
        if (!event.media_id) continue;
        const identity = event.screen_id + ":" + event.media_id;
        if (latest.has(identity)) continue;
        latest.add(identity);
        if (event.event_type !== "media_error" || !prefs.errors) continue;
        const media = Array.isArray(event.media) ? event.media[0] : event.media;
        const screen = Array.isArray(event.screens) ? event.screens[0] : event.screens;
        next.push({ id: `media:${identity}:${event.occurred_at}`, title: `Erro em ${media?.name || "conteúdo"}`, body: `Tela: ${screen?.name || "TV"} · falha registrada na reprodução.`, href: "/telas", type: "error" });
      }
    }
    setNotices(next.slice(0, 30));
  }, [organization, prefs.seasonal, prefs.offline, prefs.errors]);

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => void load(), 5 * 60_000);
    return () => window.clearInterval(interval);
  }, [load]);

  const unread = notices.filter((n) => !seen.includes(n.id));
  const markRead = (id: string) => setSeen((previous) => [...new Set([...previous, id])].slice(-200));
  const toggleDesktop = async () => {
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setPermissionMessage("Este dispositivo ou navegador não oferece Web Push."); return;
    }
    if (!organization || !user) return;
    try {
      const registration = await navigator.serviceWorker.register("/push-sw.js", { scope: "/" });
      const current = await registration.pushManager.getSubscription();
      if (prefs.desktop) {
        if (current) {
          await supabase.from("push_subscriptions").delete().eq("endpoint", current.endpoint).eq("user_id", user.id);
          await current.unsubscribe();
        }
        setPrefs((p) => ({ ...p, desktop: false }));
        setPermissionMessage("Notificações push desativadas neste dispositivo.");
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setPermissionMessage("Permissão não concedida. Ative as notificações nas configurações do aparelho.");
        return;
      }
      const { data: publicKey, error: keyError } = await supabase.rpc("push_public_key");
      if (keyError || typeof publicKey !== "string" || !publicKey) throw new Error("Chave de notificações indisponível.");
      const base64 = publicKey.replace(/-/g, "+").replace(/_/g, "/");
      const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
      const applicationServerKey = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      const sub = current || await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
      const subscription = sub.toJSON();
      if (!subscription.keys?.p256dh || !subscription.keys.auth) throw new Error("Inscrição push incompleta.");
      const { error } = await supabase.from("push_subscriptions").upsert({
        user_id: user.id, organization_id: organization.id, endpoint: sub.endpoint,
        p256dh: subscription.keys.p256dh, auth: subscription.keys.auth, enabled: true,
        notify_seasonal: prefs.seasonal, notify_offline: prefs.offline, notify_errors: prefs.errors, notify_recovered: prefs.recovered,
        updated_at: new Date().toISOString()
      }, { onConflict: "endpoint" });
      if (error) throw error;
      setPrefs((p) => ({ ...p, desktop: true }));
      setPermissionMessage("Notificações ativadas neste dispositivo, inclusive com o PWA fechado.");
    } catch (error) {
      setPermissionMessage(error instanceof Error ? error.message : "Não foi possível configurar as notificações.");
    }
  };
  return (
    <div style={{ position: "relative" }}>
      <button type="button" className="icon-button" onClick={() => { setOpen((v) => !v); void load(); }} title="Central de notificações" aria-label={`Notificações: ${unread.length} não lidas`} style={{ position: "relative" }}>
        <Bell size={20} />
        {unread.length > 0 && <span style={{ position: "absolute", top: -5, right: -6, borderRadius: 20, background: "#d65b42", color: "white", fontSize: 10, padding: "1px 5px" }}>{Math.min(unread.length, 99)}</span>}
      </button>
      {open && <div style={{ position: "absolute", right: 0, top: "calc(100% + 10px)", width: "min(360px, 88vw)", maxHeight: "min(70vh, 570px)", overflowY: "auto", zIndex: 300, background: "var(--surface, #fff)", color: "var(--text, #17344f)", border: "1px solid #dce4eb", borderRadius: 18, boxShadow: "0 14px 45px #17344f22", padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <strong>Notificações</strong>
          <button type="button" onClick={() => setSeen((old) => [...new Set([...old, ...notices.map((n) => n.id)])].slice(-200))} style={{ border: 0, background: "none", color: "inherit", cursor: "pointer", fontSize: 12 }}><Check size={14} /> Marcar lidas</button>
        </div>
        <p style={{ fontSize: 12, opacity: .65, margin: "6px 0 14px" }}>Avisos para administradores. Nenhum alerta aparece na TV.</p>
        {notices.length === 0 && <p style={{ fontSize: 13 }}>Nenhum aviso no momento.</p>}
        {notices.map((n) => <button key={n.id} type="button" onClick={() => { markRead(n.id); setOpen(false); navigate(n.href); }} style={{ textAlign: "left", width: "100%", border: "1px solid #e1e8ee", borderRadius: 12, background: seen.includes(n.id) ? "#f7f9fa" : "#eef6ff", padding: 10, marginBottom: 8, color: "#18374f", cursor: "pointer" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>{n.type === "seasonal" ? <Sparkles size={16} /> : n.type === "offline" ? <Monitor size={16} /> : <TriangleAlert size={16} />}<strong style={{ fontSize: 13 }}>{n.title}</strong></span>
          <span style={{ display: "block", fontSize: 12, marginTop: 5 }}>{n.body}</span>
        </button>)}
        <details style={{ borderTop: "1px solid #e4eaf0", marginTop: 12, paddingTop: 12 }}>
          <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 700 }}>Preferências</summary>
          {([["seasonal", "Painéis sazonais"], ["offline", "TV desconectada"], ["errors", "Erros de conteúdo"], ["recovered", "TV reconectada"]] as const).map(([field, label]) => <label key={field} style={{ display: "flex", alignItems: "center", gap: 9, margin: "12px 0", fontSize: 13 }}><input type="checkbox" checked={prefs[field]} onChange={(e) => setPrefs((p) => ({ ...p, [field]: e.target.checked }))} />{label}</label>)}
          <button type="button" onClick={() => void toggleDesktop()} style={{ display: "flex", alignItems: "center", gap: 7, border: "1px solid #d6e2ec", borderRadius: 10, padding: 9, background: "transparent", color: "inherit" }}>{prefs.desktop ? <BellOff size={15} /> : <Bell size={15} />}{prefs.desktop ? "Desativar permissão" : "Autorizar notificações no dispositivo"}</button>

        </details>
      </div>}
    </div>
  );
}
