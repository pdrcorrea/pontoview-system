import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  AppWindow,
  BadgeDollarSign,
  CalendarClock,
  CircleHelp,
  Globe2,
  Headphones,
  LayoutDashboard,
  ListVideo,
  LogOut,
  Menu,
  MessageSquareText,
  Monitor,
  Settings,
  ShieldCheck,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";

const primary = [
  ["/dashboard", "Visão geral", LayoutDashboard],
  ["/conteudo", "Conteúdo", AppWindow],
  ["/playlists", "Playlists", ListVideo],
  ["/programacoes", "Programação", CalendarClock],
  ["/mensagens", "Mensagens", MessageSquareText],
  ["/telas", "Telas", Monitor],
  ["/apps", "Painéis PontoView", Sparkles],
] as const;
const account = [
  ["/conta", "Conta PontoView", UserRound],
  ["/financeiro", "Financeiro", BadgeDollarSign],
  ["/ajuda", "Ajuda", CircleHelp],
  ["/suporte", "Contato e suporte", Headphones],
] as const;

export function AppShell() {
  const { organization, profile, role, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [brandLogoFailed, setBrandLogoFailed] = useState(false);
  const [brandIconFailed, setBrandIconFailed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const title = [...primary, ...account].find(([path]) => location.pathname.startsWith(path))?.[1] || "PontoView";
  const initials = (profile?.full_name || profile?.email || "PV").split(/\s+/).slice(0, 2).map((x) => x[0]).join("").toUpperCase();

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const leave = async () => { await signOut(); navigate("/login"); };
  const links = (items: readonly (readonly [string, string, LucideIcon])[]) => items.map(([to, label, Icon]) => (
    <NavLink key={to} to={to} onClick={() => setOpen(false)} className={({ isActive }) => isActive ? "active" : ""}>
      <Icon size={18} /><span>{label}</span>
    </NavLink>
  ));
  return (
    <div className="shell">
      {open && <button className="sidebar-scrim" aria-label="Fechar menu" onClick={() => setOpen(false)} />}
      <aside id="main-sidebar" className={`sidebar ${open ? "open" : ""}`} aria-hidden={!open && undefined}>
        <div className="brand">
          {!brandLogoFailed ? (
            <img
              src="/assets/logo.png"
              alt="PontoView Telas"
              style={{ width: 154, maxWidth: "calc(100% - 34px)", height: 38, objectFit: "contain", objectPosition: "left center", display: "block", marginRight: "auto" }}
              onError={() => setBrandLogoFailed(true)}
            />
          ) : (
            <>
              <b>
                {brandIconFailed ? "PV" : (
                  <img
                    src="/assets/icon.png"
                    alt=""
                    style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
                    onError={() => setBrandIconFailed(true)}
                  />
                )}
              </b>
              <span><strong>PontoView</strong><small>Telas</small></span>
            </>
          )}
          <button className="mobile-close" aria-label="Fechar menu" onClick={() => setOpen(false)}><X size={18} /></button>
        </div>
        <div className="nav-label">PontoView Telas</div>
        <nav>{links(primary)}</nav>
        <div className="nav-label account-label">Sua conta</div>
        <nav>{links(account)}</nav>
        <NavLink className="settings" to="/configuracoes" onClick={() => setOpen(false)}><Settings size={18} /><span>Configurações</span></NavLink>
        <a className="privacy-link" href="https://pontoview.com.br" target="_blank" rel="noreferrer">
          <Globe2 size={18} /><span>Ecossistema PontoView</span>
        </a>
        <a className="privacy-link" href="https://pontoview.com.br/privacidade" target="_blank" rel="noreferrer">
          <ShieldCheck size={18} /><span>Central de Privacidade</span>
        </a>
        <div className="org-card">
          <span className="avatar">{initials}</span>
          <span><strong>{organization?.display_name || "Sua empresa"}</strong><small>{role === "owner" ? "Proprietário" : role}</small></span>
          <button className="icon-button" title="Sair" onClick={leave}><LogOut size={17} /></button>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <button className="mobile-menu" aria-label="Abrir menu" aria-controls="main-sidebar" aria-expanded={open} onClick={() => setOpen(true)}><Menu /></button>
          <div><strong>{title}</strong></div>
          <div className="top-actions">
            <span className="system-ok">● Conectado</span>
            <NavLink className="help-button" to="/ajuda"><CircleHelp size={17} /></NavLink>
            <span className="top-avatar">{initials}</span>
          </div>
        </header>
        <div className="page"><Outlet /></div>
      </main>
    </div>
  );
}
