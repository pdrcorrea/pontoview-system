import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  AppWindow,
  BadgeDollarSign,
  Building2,
  ChevronDown,
  CircleHelp,
  Globe2,
  Headphones,
  LayoutDashboard,
  ListVideo,
  LogOut,
  MessageSquareText,
  Monitor,
  Settings,
  ShieldCheck,
  Sparkles,
  UserRound,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { supabase } from "../lib/supabase";

const primary = [
  ["/dashboard", "Visão geral", LayoutDashboard],
  ["/conteudo", "Conteúdo", AppWindow],
  ["/playlists", "Playlists", ListVideo],
  ["/mensagens", "Mensagens", MessageSquareText],
  ["/telas", "Telas", Monitor],
  ["/apps", "Painéis PontoView", Sparkles],
] as const;

const account = [
  ["/conta", "Perfil", UserRound],
  ["/empresa", "Empresa", Building2],
  ["/financeiro", "Financeiro", BadgeDollarSign],
  ["/ajuda", "Ajuda", CircleHelp],
  ["/suporte", "Contato e suporte", Headphones],
  ["/configuracoes", "Configurações", Settings],
] as const;

const mobileNav = [
  ["/dashboard", "Início", LayoutDashboard],
  ["/conteudo", "Conteúdo", AppWindow],
  ["/playlists", "Playlists", ListVideo],
  ["/mensagens", "Mensagens", MessageSquareText],
  ["/telas", "Telas", Monitor],
  ["/apps", "Painéis", Sparkles],
  ["/conta", "Conta", UserRound],
] as const;

export function AppShell() {
  const { organization, profile, role, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const accountRouteActive = useMemo(
    () => account.some(([path]) => location.pathname.startsWith(path)),
    [location.pathname],
  );
  const [accountOpen, setAccountOpen] = useState(accountRouteActive);
  const [screenHealth, setScreenHealth] = useState({ total: 0, online: 0 });
  const title = location.pathname.startsWith("/programacoes")
    ? "Programação de grupos"
    : [...primary, ...account].find(([path]) => location.pathname.startsWith(path))?.[1] || "PontoView";
  const initials = (profile?.full_name || profile?.email || "PV")
    .split(/\s+/)
    .slice(0, 2)
    .map((x) => x[0])
    .join("")
    .toUpperCase();

  useEffect(() => {
    if (accountRouteActive) setAccountOpen(true);
  }, [location.pathname, accountRouteActive]);

  const loadScreenHealth = useCallback(async () => {
    if (!organization) {
      setScreenHealth({ total: 0, online: 0 });
      return;
    }
    const result = await supabase
      .from("screens")
      .select("id,screen_status(last_seen)")
      .eq("organization_id", organization.id)
      .eq("is_active", true);
    if (result.error) return;
    const now = Date.now();
    const rows = result.data || [];
    const online = rows.filter((row) => {
      const raw = row.screen_status as unknown as
        | { last_seen?: string | null }
        | Array<{ last_seen?: string | null }>
        | null;
      const status = Array.isArray(raw) ? raw[0] : raw;
      return Boolean(status?.last_seen && now - new Date(status.last_seen).getTime() < 120000);
    }).length;
    setScreenHealth({ total: rows.length, online });
  }, [organization]);

  useEffect(() => {
    void loadScreenHealth();
    if (!organization) return;
    const channel = supabase
      .channel(`shell-screen-health:${organization.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "screen_status", filter: `organization_id=eq.${organization.id}` },
        () => void loadScreenHealth(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "screens", filter: `organization_id=eq.${organization.id}` },
        () => void loadScreenHealth(),
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [organization, loadScreenHealth]);

  const leave = async () => {
    await signOut();
    navigate("/login");
  };

  const links = (items: readonly (readonly [string, string, LucideIcon])[]) =>
    items.map(([to, label, Icon]) => (
      <NavLink key={to} to={to} className={({ isActive }) => (isActive ? "active" : "")}>
        <Icon size={18} />
        <span>{label}</span>
      </NavLink>
    ));

  const offline = Math.max(0, screenHealth.total - screenHealth.online);

  return (
    <div className="shell">
      <aside id="main-sidebar" className="sidebar">
        <div className="brand pv-full-brand">
          <img src="/assets/logo.png" alt="PontoView" />
          <span className="sidebar-product-badge">Telas</span>
        </div>

        <div className={`sidebar-screen-health ${offline > 0 ? "attention" : screenHealth.total ? "healthy" : "empty"}`}>
          <span className="sidebar-health-icon">{offline > 0 ? <WifiOff /> : <Wifi />}</span>
          <span>
            <b>{screenHealth.total ? `${screenHealth.online}/${screenHealth.total} telas online` : "Nenhuma tela conectada"}</b>
            <small>{offline > 0 ? `${offline} precisa${offline > 1 ? "m" : ""} de atenção` : screenHealth.total ? "Tudo funcionando" : "Conecte sua primeira tela"}</small>
          </span>
        </div>

        <div className="nav-label">PontoView Telas</div>
        <nav>{links(primary)}</nav>

        <div className="account-menu-block">
          <button
            className={`account-menu-toggle ${accountOpen ? "open" : ""}`}
            onClick={() => setAccountOpen((current) => !current)}
            aria-expanded={accountOpen}
          >
            <UserRound size={18} />
            <span>Minha conta</span>
            <ChevronDown size={16} />
          </button>
          <nav className={`account-menu-content ${accountOpen ? "open" : ""}`}>
            {links(account)}
            <a className="privacy-link" href="https://pontoview.com.br/privacidade" target="_blank" rel="noreferrer">
              <ShieldCheck size={18} /><span>Privacidade</span>
            </a>
            <a className="privacy-link" href="https://pontoview.com.br" target="_blank" rel="noreferrer">
              <Globe2 size={18} /><span>Ecossistema PontoView</span>
            </a>
          </nav>
        </div>

        <div className="org-card">
          <span className="avatar">{initials}</span>
          <span>
            <strong>{organization?.display_name || "Sua empresa"}</strong>
            <small>{role === "owner" ? "Proprietário" : role}</small>
          </span>
          <button className="icon-button" title="Sair" onClick={leave}><LogOut size={17} /></button>
        </div>
      </aside>

      <main>
        <header className="topbar">
          <div><strong>{title}</strong></div>
          <div className="top-actions">
            <span className="system-ok">● Conectado</span>
            <NavLink className="help-button" to="/ajuda" title="Ajuda"><CircleHelp size={17} /></NavLink>
          </div>
        </header>
        <div className="page"><Outlet /></div>
      </main>

      <nav className="mobile-glass-nav" aria-label="Navegação principal">
        <div className="mobile-glass-track">
          {mobileNav.map(([to, label, Icon]) => (
            <NavLink key={to} to={to} className={({ isActive }) => (isActive ? "active" : "")}>
              <span className="mobile-glass-icon"><Icon size={20} /></span>
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
