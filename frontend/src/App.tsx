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
import { DashboardPage } from "./pages/Dashboard";
import { ContentPage } from "./pages/Content";
import { PlaylistsPage } from "./pages/Playlists";
import { SchedulesPage } from "./pages/Schedules";
import { MessagesPage } from "./pages/Messages";
import { ScreensPage } from "./pages/Screens";
import { AccountPage, OnboardingPage, SettingsPage } from "./pages/Account";
import { BillingPage } from "./pages/Billing";
import { AppsPage, HelpPage } from "./pages/Help";
import { SupportPage } from "./pages/Support";
import { PlayerPage } from "./player/Player";
import "./styles.css";
import "./styles-v2.css";
import "./system.css";

function Protected() {
  const { loading, user, profile } = useAuth();
  const location = useLocation();
  if (loading) return <LoadingScreen label="Carregando sua PontoView" />;
  if (!user)
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (
    profile &&
    !profile.onboarding_completed &&
    location.pathname !== "/onboarding"
  )
    return <Navigate to="/onboarding" replace />;
  return <AppShell />;
}

function Guest({ children }: { children: React.ReactNode }) {
  const { loading, user } = useAuth();
  if (loading) return <LoadingScreen />;
  return user ? <Navigate to="/dashboard" replace /> : children;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/player" element={<PlayerPage />} />
        <Route path="/player/:screenId" element={<PlayerPage />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route
          path="/login"
          element={
            <Guest>
              <LoginPage />
            </Guest>
          }
        />
        <Route
          path="/cadastro"
          element={
            <Guest>
              <SignupPage />
            </Guest>
          }
        />
        <Route
          path="/recuperar-senha"
          element={
            <Guest>
              <RecoveryPage />
            </Guest>
          }
        />
        <Route path="/redefinir-senha" element={<ResetPasswordPage />} />
        <Route path="/" element={<Protected />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="onboarding" element={<OnboardingPage />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="conteudo" element={<ContentPage />} />
          <Route path="playlists" element={<PlaylistsPage />} />
          <Route path="programacoes" element={<SchedulesPage />} />
          <Route path="mensagens" element={<MessagesPage />} />
          <Route path="telas" element={<ScreensPage />} />
          <Route path="apps" element={<AppsPage />} />
          <Route path="conta" element={<AccountPage />} />
          <Route path="financeiro" element={<BillingPage />} />
          <Route path="ajuda" element={<HelpPage />} />
          <Route path="suporte" element={<SupportPage />} />
          <Route path="configuracoes" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AuthProvider>
  );
}
