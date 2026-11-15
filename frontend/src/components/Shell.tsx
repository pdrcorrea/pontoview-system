import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  AppWindow,
  BadgeDollarSign,
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
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
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { NotificationCenter } from "./NotificationCenter";

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

const SIDEBAR_KEY = "pontoview_telas_sidebar_collapsed";

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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem(SIDEBAR_KEY) === "true");
  const initials = (profile?.full_name || profile?.email || "PV")
    .split(/\s+/)
    .slice(0, 2)
    .map((x) => x[0])
    .join("")
    .toUpperCase();

  useEffect(() => {
    if (accountRouteActive) setAccountOpen(true);
  }, [location.pathname, accountRouteActive]);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_KEY, String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  const leave = async () => {
    await signOut();
    navigate("/login");
  };

  const links = (items: readonly (readonly [string, string, LucideIcon])[]) =>
    items.map(([to, label, Icon]) => (
      <NavLink
        key={to}
        to={to}
        title={label}
        aria-label={label}
        className={({ isActive }) => (isActive ? "active" : "")}
      >
        <Icon size={18} />
        <span>{label}</span>
      </NavLink>
    ));

  return (
    <div className={`shell ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      <aside id="main-sidebar" className={`sidebar ${sidebarCollapsed ? "collapsed" : ""}`}>
        <div className="telas-sidebar-brand" aria-label="PontoView Telas">
          <img className="telas-sidebar-brand-icon" src="/assets/pontoview-telas-soft3d.svg" alt="" />
          <span className="telas-sidebar-brand-wordmark"><strong>Ponto</strong>View</span>
          <span className="telas-sidebar-brand-product">Telas</span>
        </div>

        <nav>{links(primary)}</nav>

        <div className="account-menu-block">
          <button
            className={`account-menu-toggle ${accountOpen ? "open" : ""}`}
            onClick={() => sidebarCollapsed ? navigate("/conta") : setAccountOpen((current) => !current)}
            title={sidebarCollapsed ? "Minha conta" : undefined}
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

        <button
          type="button"
          className="sidebar-collapse-toggle"
          onClick={() => setSidebarCollapsed((current) => !current)}
          aria-label={sidebarCollapsed ? "Expandir menu" : "Recolher menu"}
          title={sidebarCollapsed ? "Expandir menu" : undefined}
        >
          {sidebarCollapsed ? <ChevronRight size={17} /> : <><ChevronLeft size={17} /><span>Recolher</span></>}
        </button>

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
        <header className="topbar telas-topbar" aria-label="Ações do painel">
          <div className="top-actions telas-topbar-actions">
            <NotificationCenter />
            <NavLink className="help-button" to="/ajuda" title="Central de ajuda" aria-label="Central de ajuda"><CircleHelp size={18} /></NavLink>
          </div>
        </header>

        {accountRouteActive && (
          <nav className="mobile-account-subnav" aria-label="Opções da conta">
            <div className="mobile-account-subnav-track">
              {account.map(([to, label, Icon]) => (
                <NavLink key={to} to={to} className={({ isActive }) => (isActive ? "active" : "")}>
                  <Icon size={16} />
                  <span>{label === "Contato e suporte" ? "Suporte" : label}</span>
                </NavLink>
              ))}
              <a className="external" href="https://pontoview.com.br/privacidade" target="_blank" rel="noreferrer">
                <ShieldCheck size={16} />
                <span>Privacidade</span>
              </a>
            </div>
          </nav>
        )}

        <div className="page"><Outlet /></div>
      </main>

      <nav className="mobile-glass-nav" aria-label="Navegação principal">
        <div className="mobile-glass-track">
          {mobileNav.map(([to, label, Icon]) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => isActive || (to === "/conta" && accountRouteActive) ? "active" : ""}
            >
              <span className="mobile-glass-icon"><Icon size={20} /></span>
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
