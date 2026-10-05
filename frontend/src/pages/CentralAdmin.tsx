import { useEffect, useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import type { User } from "@supabase/supabase-js";
import { Loader2, LockKeyhole, LogOut, Mail, ShieldCheck } from "lucide-react";
import { FormMessage, LoadingScreen } from "../components/ui";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import { ContentHubPage } from "./ContentHub";
import "../central-admin.css";

function isCentralAdmin(user: User | null | undefined) {
  return String(user?.app_metadata?.content_hub_role || "") === "admin";
}

function centralBasePath() {
  return window.location.hostname.toLowerCase() === "central.pontoview.com.br" ? "" : "/central-conteudo";
}

function centralHomePath() {
  return centralBasePath() || "/";
}

function centralLoginPath() {
  return `${centralBasePath()}/login` || "/login";
}

function useCentralSession() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    let alive = true;
    const timeout = window.setTimeout(() => {
      if (alive) setLoading(false);
    }, 4000);

    void supabase.auth.getSession()
      .then(({ data }) => {
        if (!alive) return;
        setUser(data.session?.user || null);
        setLoading(false);
      })
      .catch(() => {
        if (!alive) return;
        setUser(null);
        setLoading(false);
      })
      .finally(() => window.clearTimeout(timeout));

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!alive) return;
      setUser(session?.user || null);
      setLoading(false);
    });

    return () => {
      alive = false;
      window.clearTimeout(timeout);
      data.subscription.unsubscribe();
    };
  }, []);

  return { loading, user };
}

export function CentralAdminLoginPage() {
  const { loading, user } = useCentralSession();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user && isCentralAdmin(user)) navigate(centralHomePath(), { replace: true });
  }, [loading, user, navigate]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    if (!isSupabaseConfigured) {
      setError("O serviço administrativo está temporariamente indisponível. Tente novamente em instantes.");
      setBusy(false);
      return;
    }

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "").trim();
    const password = String(form.get("password") || "");

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      if (!isCentralAdmin(data.user)) {
        await supabase.auth.signOut();
        setError("Acesso administrativo não autorizado.");
        return;
      }
      navigate(centralHomePath(), { replace: true });
    } catch (reason) {
      setError(
        reason instanceof Error && reason.message === "Failed to fetch"
          ? "Não foi possível conectar ao serviço de autenticação agora."
          : "Não foi possível autenticar o acesso administrativo.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <LoadingScreen label="Verificando acesso administrativo" />;
  if (user && isCentralAdmin(user)) return <Navigate to={centralHomePath()} replace />;

  return (
    <main className="central-admin-login">
      <section className="central-admin-login-card">
        <div className="central-admin-mark"><img src="/assets/icon.png" alt="" /></div>
        <span className="central-admin-kicker"><ShieldCheck size={15} /> Administração PontoView</span>
        <h1>Central de Conteúdo</h1>
        <p className="central-admin-description">Área editorial privada para revisão e publicação dos conteúdos distribuídos pela PontoView.</p>

        <form onSubmit={submit} className="central-admin-form">
          <label>
            E-mail
            <span className="central-admin-field">
              <Mail size={18} />
              <input name="email" type="email" required autoComplete="username" placeholder="E-mail administrativo" autoFocus />
            </span>
          </label>
          <label>
            Senha
            <span className="central-admin-field">
              <LockKeyhole size={18} />
              <input name="password" type="password" required autoComplete="current-password" placeholder="Sua senha de acesso" />
            </span>
          </label>
          <FormMessage error={error} />
          <button className="central-admin-submit" type="submit" disabled={busy}>
            {busy ? <Loader2 size={18} className="spin" /> : <ShieldCheck size={18} />}
            {busy ? "Verificando…" : "Entrar na Central"}
          </button>
        </form>

        <small className="central-admin-footnote">Acesso restrito à administração da PontoView. Não há cadastro público.</small>
      </section>
    </main>
  );
}

export function CentralAdminGate() {
  const { loading, user } = useCentralSession();
  const navigate = useNavigate();

  if (loading) return <LoadingScreen label="Abrindo a Central de Conteúdo" />;
  if (!user) return <Navigate to={centralLoginPath()} replace />;

  if (!isCentralAdmin(user)) {
    return (
      <main className="central-admin-denied">
        <section>
          <ShieldCheck size={28} />
          <h1>Acesso restrito</h1>
          <p>Esta conta não está autorizada a administrar a Central de Conteúdo.</p>
          <button onClick={async () => { await supabase.auth.signOut(); navigate(centralLoginPath(), { replace: true }); }}>
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
        <button onClick={async () => { await supabase.auth.signOut(); navigate(centralLoginPath(), { replace: true }); }}>
          <LogOut size={16} /> Sair
        </button>
      </div>
      <ContentHubPage />
    </div>
  );
}
