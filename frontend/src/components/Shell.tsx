import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  AppWindow,
  BadgeDollarSign,
  CalendarClock,
  CircleHelp,
  Headphones,
  LayoutDashboard,
  ListVideo,
  LogOut,
  Menu,
  MessageSquareText,
  Monitor,
  Settings,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import { useState } from "react";
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
  ["/conta", "Minha conta", UserRound],
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
  const leave = async () => { await signOut(); navigate("/login"); };
  const links = (items: readonly (readonly [string, string, LucideIcon])[]) => items.map(([to, label, Icon]) => (
    <NavLink key={to} to={to} onClick={() => setOpen(false)} className={({ isActive }) => isActive ? "active" : ""}>
      <Icon size={18} /><span>{label}</span>
    </NavLink>
  ));
  return (
    <div className="shell">
      {open && <button className="sidebar-scrim" aria-label="Fechar menu" onClick={() => setOpen(false)} />}
      <aside className={`sidebar ${open ? "open" : ""}`}>
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
          <button className="mobile-close" onClick={() => setOpen(false)}><X size={18} /></button>
        </div>
        <div className="nav-label">Workspace</div>
        <nav>{links(primary)}</nav>
        <div className="nav-label account-label">Conta</div>
        <nav>{links(account)}</nav>
        <NavLink className="settings" to="/configuracoes"><Settings size={18} /><span>Configurações</span></NavLink>
        <div className="org-card">
          <span className="avatar">{initials}</span>
          <span><strong>{organization?.display_name || "Sua empresa"}</strong><small>{role === "owner" ? "Proprietário" : role}</small></span>
          <button className="icon-button" title="Sair" onClick={leave}><LogOut size={17} /></button>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setOpen(true)}><Menu /></button>
          <div><small>PontoView Telas</small><strong>{title}</strong></div>
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
