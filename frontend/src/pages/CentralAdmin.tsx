import { useEffect, useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Loader2, LockKeyhole, LogOut, Mail, ShieldCheck } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { FormMessage, LoadingScreen } from "../components/ui";
import { supabase } from "../lib/supabase";
import { ContentHubPage } from "./ContentHub";
import "../central-admin.css";

function isCentralAdmin(user: { app_metadata?: Record<string, unknown> } | null | undefined) {
  return String(user?.app_metadata?.content_hub_role || "") === "admin";
}

export function CentralAdminLoginPage() {
  const { loading, user, signOut } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading || !user) return;
    if (isCentralAdmin(user)) {
      navigate("/central-conteudo", { replace: true });
      return;
    }
    void signOut();
  }, [loading, user, navigate, signOut]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "").trim();
    const password = String(form.get("password") || "");

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) throw signInError;
      if (!isCentralAdmin(data.user)) {
        await supabase.auth.signOut();
        setError("Acesso administrativo não autorizado.");
        return;
      }

      navigate("/central-conteudo", { replace: true });
    } catch (reason) {
      setError(
        reason instanceof Error && reason.message === "Failed to fetch"
          ? "A Central ainda não conseguiu se conectar ao serviço de autenticação."
          : "Não foi possível autenticar o acesso administrativo.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <LoadingScreen label="Verificando acesso administrativo" />;
  if (user && isCentralAdmin(user)) return <Navigate to="/central-conteudo" replace />;

  return (
    <main className="central-admin-login">
      <section className="central-admin-login-card">
        <div className="central-admin-mark">
          <img src="/assets/icon.png" alt="" />
        </div>
        <span className="central-admin-kicker"><ShieldCheck size={15} /> Administração PontoView</span>
        <h1>Central de Conteúdo</h1>
        <p className="central-admin-description">
          Área editorial privada para revisão e publicação dos conteúdos distribuídos pela PontoView.
        </p>

        <form onSubmit={submit} className="central-admin-form">
          <label>
            E-mail
            <span className="central-admin-field">
              <Mail size={18} />
              <input
                name="email"
                type="email"
                required
                autoComplete="username"
                placeholder="E-mail administrativo"
                autoFocus
              />
            </span>
          </label>
          <label>
            Senha
            <span className="central-admin-field">
              <LockKeyhole size={18} />
              <input
                name="password"
                type="password"
                required
                autoComplete="current-password"
                placeholder="Sua senha de acesso"
              />
            </span>
          </label>
          <FormMessage error={error} />
          <button className="central-admin-submit" type="submit" disabled={busy}>
            {busy ? <Loader2 size={18} className="spin" /> : <ShieldCheck size={18} />}
            {busy ? "Verificando…" : "Entrar na Central"}
          </button>
        </form>

        <small className="central-admin-footnote">
          Acesso restrito à administração da PontoView. Não há cadastro público.
        </small>
      </section>
    </main>
  );
}

export function CentralAdminGate() {
  const { loading, user, signOut } = useAuth();
  const navigate = useNavigate();

  if (loading) return <LoadingScreen label="Abrindo a Central de Conteúdo" />;
  if (!user) return <Navigate to="/central-conteudo/login" replace />;

  if (!isCentralAdmin(user)) {
    return (
      <main className="central-admin-denied">
        <section>
          <ShieldCheck size={28} />
          <h1>Acesso restrito</h1>
          <p>Esta conta não está autorizada a administrar a Central de Conteúdo.</p>
          <button
            onClick={async () => {
              await signOut();
              navigate("/central-conteudo/login", { replace: true });
            }}
          >
            <LogOut size={17} /> Sair
          </button>
        </section>
      </main>
    );
  }

  return (
    <div className="central-admin-workspace">
      <div className="central-admin-sessionbar">
        <span><ShieldCheck size={15} /> Acesso administrativo</span>
        <button
          onClick={async () => {
            await signOut();
            navigate("/central-conteudo/login", { replace: true });
          }}
        >
          <LogOut size={16} /> Sair
        </button>
      </div>
      <ContentHubPage />
    </div>
  );
}
