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
  Menu,
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
  ["/telas", "Telas", Monitor],
] as const;

const mobileMoreNav = [
  ["/mensagens", "Mensagens", MessageSquareText],
  ["/apps", "Painéis", Sparkles],
  ["/conta", "Minha conta", UserRound],
  ["/ajuda", "Ajuda", CircleHelp],
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
  const [isMobile, setIsMobile] = useState(() => window.matchMedia("(max-width: 650px)").matches);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem(SIDEBAR_KEY) === "true");
  const initials = (profile?.full_name || profile?.email || "PV")
    .split(/\s+/)
    .slice(0, 2)
    .map((x) => x[0])
    .join("")
    .toUpperCase();

  useEffect(() => {
    if (accountRouteActive) setAccountOpen(true);
    setMobileMoreOpen(false);
  }, [location.pathname, accountRouteActive]);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 650px)");
    const onChange = (event: MediaQueryListEvent) => setIsMobile(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_KEY, String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const button = target.closest<HTMLElement>(".shell .btn.primary, .shell button.primary:not(.danger), .shell .button-primary");
      if (!button) return;
      const bounds = button.getBoundingClientRect();
      button.style.setProperty("--pv-x", `${event.clientX - bounds.left}px`);
      button.style.setProperty("--pv-y", `${event.clientY - bounds.top}px`);
    };
    document.addEventListener("pointermove", onPointerMove, { passive: true });
    return () => document.removeEventListener("pointermove", onPointerMove);
  }, []);

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

        <div className="sidebar-utility-nav">
          {!isMobile && <NotificationCenter label collapsed={sidebarCollapsed} />}
          <NavLink to="/ajuda" className="sidebar-utility-link" title="Ajuda" aria-label="Ajuda"><CircleHelp size={18} /><span>Ajuda</span></NavLink>
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

      {isMobile && mobileMoreOpen && (
        <div className="mobile-more-overlay">
          <button type="button" className="mobile-more-backdrop" aria-label="Fechar menu" onClick={() => setMobileMoreOpen(false)} />
          <div className="mobile-more-sheet" role="dialog" aria-label="Mais opções">
            <div className="mobile-more-sheet-heading">
              <strong>Mais opções</strong>
              <button type="button" onClick={() => setMobileMoreOpen(false)} aria-label="Fechar menu">Fechar</button>
            </div>
            <div className="mobile-more-sheet-links">
              {mobileMoreNav.map(([to, label, Icon]) => (
                <NavLink key={to} to={to} onClick={() => setMobileMoreOpen(false)}>
                  <Icon size={20} /><span>{label}</span>
                </NavLink>
              ))}
              <div className="mobile-more-notifications"><NotificationCenter mobile label /></div>
            </div>
          </div>
        </div>
      )}

      <nav className="mobile-glass-nav" aria-label="Navegação principal">
        <div className="mobile-glass-track">
          {mobileNav.map(([to, label, Icon]) => (
            <NavLink key={to} to={to} className={({ isActive }) => isActive ? "active" : ""}>
              <span className="mobile-glass-icon"><Icon size={20} /></span>
              <span>{label}</span>
            </NavLink>
          ))}
          <button
            type="button"
            className={`mobile-more-trigger ${mobileMoreOpen || mobileMoreNav.some(([to]) => location.pathname.startsWith(to)) ? "active" : ""}`}
            onClick={() => setMobileMoreOpen((value) => !value)}
            aria-expanded={mobileMoreOpen}
            aria-label="Mais opções"
          >
            <span className="mobile-glass-icon"><Menu size={20} /></span>
            <span>Mais</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
