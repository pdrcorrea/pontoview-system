import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthProvider";
import { AppShell } from "./components/Shell";
import { LoadingScreen } from "./components/ui";
import {
  AuthCallback,
  LoginPage,
  RecoveryPage,
  ResetPasswordPage,
  SignupPage,
} from "./pages/Auth";
import { HomePage } from "./pages/Home";
import { DashboardPage } from "./pages/Dashboard";
import { ContentReorganizedPage } from "./pages/ContentReorganized";
import { CentralAdminGate, CentralAdminLoginPage } from "./pages/CentralAdmin";
import { ContentPortalPage } from "./pages/ContentPortal";
import { PanelsCatalogPage } from "./pages/PanelsCatalog";
import { PlaylistsPage } from "./pages/PlaylistsV2";
import { SchedulesPage } from "./pages/Schedules";
import { MessagesSimplePage } from "./pages/MessagesSimple";
import { ScreensSimplePage } from "./pages/ScreensSimple";
import { AccountPage, OnboardingPage, SettingsPage } from "./pages/Account";
import { UserAccountPage } from "./pages/UserAccount";
import { BillingPage } from "./pages/Billing";
import { HelpPage } from "./pages/Help";
import { SupportPage } from "./pages/Support";
import { PlayerPage } from "./player/Player";
import "./styles.css";
import "./styles-v2.css";
import "./system.css";
import "./panels.css";
import "./branding.css";
import "./refinements.css";
import "./brand-mobile-fixes.css";
import "./playlist-builder.css";
import "./screen-experience.css";
import "./messages-experience.css";
import "./account-experience.css";
import "./pontoview-clean-preview.css";
import "./pontoview-ux-polish.css";
import "./mobile-account-nav.css";
import "./mobile-dock-safety.css";
import "./panelThumbs";
import "./content-ecosystem-theme.css";

const PLAYER_HOSTS = new Set(["tv.pontoview.com.br"]);
const CENTRAL_HOSTS = new Set(["central.pontoview.com.br"]);
const CONTENT_HOSTS = new Set(["conteudo.pontoview.com.br"]);

function hostname() {
  return window.location.hostname.toLowerCase();
}

function Protected() {
  const { loading, user, profile } = useAuth();
  const location = useLocation();
  if (loading) return <LoadingScreen label="Carregando sua PontoView" />;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (profile && !profile.onboarding_completed && location.pathname !== "/onboarding") return <Navigate to="/onboarding" replace />;
  return <AppShell />;
}

function Guest({ children }: { children: React.ReactNode }) {
  const { loading, user } = useAuth();
  if (loading) return <LoadingScreen />;
  return user ? <Navigate to="/dashboard" replace /> : children;
}

function CentralHostApp() {
  return (
    <AuthProvider mode="session">
      <Routes>
        <Route path="/login" element={<CentralAdminLoginPage />} />
        <Route path="*" element={<CentralAdminGate />} />
      </Routes>
    </AuthProvider>
  );
}

function CentralPreviewApp() {
  return (
    <AuthProvider mode="session">
      <Routes>
        <Route path="/central-conteudo/login" element={<CentralAdminLoginPage />} />
        <Route path="/central-conteudo" element={<CentralAdminGate />} />
        <Route path="*" element={<Navigate to="/central-conteudo" replace />} />
      </Routes>
    </AuthProvider>
  );
}

function ContentHostApp() {
  return (
    <Routes>
      <Route path="/" element={<ContentPortalPage />} />
      <Route path="/:slug" element={<ContentPortalPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function ContentPreviewApp() {
  return (
    <Routes>
      <Route path="/conteudo-publico" element={<ContentPortalPage />} />
      <Route path="/conteudo-publico/:slug" element={<ContentPortalPage />} />
      <Route path="*" element={<Navigate to="/conteudo-publico" replace />} />
    </Routes>
  );
}

export default function App() {
  const host = hostname();
  const path = window.location.pathname;

  if (PLAYER_HOSTS.has(host)) {
    return <Routes><Route path="*" element={<PlayerPage />} /></Routes>;
  }
  if (CENTRAL_HOSTS.has(host)) return <CentralHostApp />;
  if (CONTENT_HOSTS.has(host)) return <ContentHostApp />;
  if (path.startsWith("/central-conteudo")) return <CentralPreviewApp />;
  if (path.startsWith("/conteudo-publico")) return <ContentPreviewApp />;

  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/player" element={<PlayerPage />} />
        <Route path="/player/:screenId" element={<PlayerPage />} />
        <Route path="/auth/confirmado" element={<AuthCallback />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/login" element={<Guest><LoginPage /></Guest>} />
        <Route path="/cadastro" element={<Guest><SignupPage /></Guest>} />
        <Route path="/recuperar-senha" element={<Guest><RecoveryPage /></Guest>} />
        <Route path="/redefinir-senha" element={<ResetPasswordPage />} />

        <Route element={<Protected />}>
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/conteudo" element={<ContentReorganizedPage />} />
          <Route path="/playlists" element={<PlaylistsPage />} />
          <Route path="/programacoes" element={<SchedulesPage />} />
          <Route path="/mensagens" element={<MessagesSimplePage />} />
          <Route path="/telas" element={<ScreensSimplePage />} />
          <Route path="/apps" element={<PanelsCatalogPage />} />
          <Route path="/conta" element={<UserAccountPage />} />
          <Route path="/empresa" element={<AccountPage />} />
          <Route path="/financeiro" element={<BillingPage />} />
          <Route path="/ajuda" element={<HelpPage />} />
          <Route path="/suporte" element={<SupportPage />} />
          <Route path="/configuracoes" element={<SettingsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
