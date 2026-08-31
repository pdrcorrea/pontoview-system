import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Building2,
  KeyRound,
  LockKeyhole,
  Mail,
  Monitor,
  UserRound,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { AsyncButton, FormMessage, formData } from "../components/ui";
import "../auth-main.css";

function AuthLayout({
  title,
  text,
  children,
}: {
  title: string;
  text: string;
  children: React.ReactNode;
}) {
  const location = useLocation();
  const showTabs = ["/login", "/cadastro"].includes(location.pathname);

  return (
    <div className="auth-page auth-main-style">
      <section className="auth-brand">
        <div className="auth-main-brand">
          <span className="auth-main-brandmark"><Monitor /></span>
          <span>
            <strong>PontoView</strong>
            <small>Telas</small>
          </span>
        </div>

        <div className="auth-main-pitch">
          <span>MÍDIA INDOOR</span>
          <h1>Sua comunicação, sempre em movimento.</h1>
          <p>
            Organize conteúdos para TVs e combine mídias próprias com painéis
            automáticos de clima, notícias, economia, cultura e muito mais.
          </p>
        </div>

        <small className="auth-main-foot">PontoView Telas</small>
      </section>

      <main className="auth-card">
        <div className="auth-main-card">
          <span className="auth-main-eyebrow">ÁREA DO CLIENTE</span>
          <h2>{title}</h2>
          <p>{text}</p>

          {showTabs && (
            <nav className="auth-main-tabs" aria-label="Acesso">
              <Link
                className={location.pathname === "/login" ? "active" : ""}
                to="/login"
              >
                Entrar
              </Link>
              <Link
                className={location.pathname === "/cadastro" ? "active" : ""}
                to="/cadastro"
              >
                Criar conta
              </Link>
            </nav>
          )}

          {children}
        </div>
      </main>
    </div>
  );
}

export function LoginPage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const data = formData(e);
    const result = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });
    setBusy(false);
    if (result.error) setError(result.error.message);
    else navigate((location.state as { from?: string })?.from || "/dashboard");
  };
  return (
    <AuthLayout title="Bem-vindo." text="Entre na sua conta para acessar o PontoView Telas.">
      <form onSubmit={submit} className="auth-form">
        <label>
          E-mail
          <span>
            <Mail />
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="voce@empresa.com.br"
            />
          </span>
        </label>
        <label>
          Senha
          <span>
            <LockKeyhole />
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="Sua senha"
            />
          </span>
        </label>
        <FormMessage error={error} />
        <AsyncButton busy={busy} className="btn primary full">
          Entrar
        </AsyncButton>
        <Link className="forgot auth-main-forgot" to="/recuperar-senha">
          Esqueci minha senha
        </Link>
      </form>
    </AuthLayout>
  );
}

export function SignupPage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const data = formData(e);
    if (data.password.length < 8) {
      setError("Use pelo menos 8 caracteres na senha.");
      setBusy(false);
      return;
    }
    const result = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: {
          full_name: data.name,
          organization_name: data.organization,
          product: "screens",
        },
      },
    });
    setBusy(false);
    if (result.error) setError(result.error.message);
    else setSent(true);
  };
  if (sent)
    return (
      <AuthLayout title="Confirme seu e-mail." text="Enviamos um link para concluir seu cadastro.">
        <div className="auth-success">
          <Mail />
          <p>Abra o e-mail de confirmação para ativar sua conta.</p>
        </div>
        <Link className="btn secondary full" to="/login">
          Voltar ao login
        </Link>
      </AuthLayout>
    );
  return (
    <AuthLayout title="Crie sua conta." text="Comece seu período de avaliação do PontoView Telas.">
      <form onSubmit={submit} className="auth-form">
        <label>
          Seu nome
          <span>
            <UserRound />
            <input name="name" required autoComplete="name" />
          </span>
        </label>
        <label>
          Empresa
          <span>
            <Building2 />
            <input name="organization" required autoComplete="organization" />
          </span>
        </label>
        <label>
          E-mail
          <span>
            <Mail />
            <input name="email" type="email" required autoComplete="email" />
          </span>
        </label>
        <label>
          Senha
          <span>
            <LockKeyhole />
            <input
              name="password"
              type="password"
              minLength={8}
              required
              autoComplete="new-password"
            />
          </span>
        </label>
        <FormMessage error={error} />
        <AsyncButton busy={busy} className="btn primary full">
          Criar conta
        </AsyncButton>
      </form>
    </AuthLayout>
  );
}

export function RecoveryPage() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    const data = formData(e);
    const result = await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    });
    setBusy(false);
    if (result.error) setError(result.error.message);
    else
      setMessage(
        "Se o e-mail estiver cadastrado, você receberá o link de redefinição.",
      );
  };
  return (
    <AuthLayout title="Recuperar senha." text="Informe seu e-mail para receber o link de acesso.">
      <form className="auth-form" onSubmit={submit}>
        <label>
          E-mail
          <span>
            <Mail />
            <input name="email" type="email" required />
          </span>
        </label>
        <FormMessage error={error} success={message} />
        <AsyncButton busy={busy} className="btn primary full">
          Enviar link
        </AsyncButton>
      </form>
      <p className="auth-switch">
        <Link to="/login">Voltar ao login</Link>
      </p>
    </AuthLayout>
  );
}

export function ResetPasswordPage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    const data = formData(e);
    if (data.password !== data.confirm) {
      setError("As senhas não coincidem.");
      setBusy(false);
      return;
    }
    const result = await supabase.auth.updateUser({ password: data.password });
    setBusy(false);
    if (result.error) setError(result.error.message);
    else navigate("/dashboard");
  };
  return (
    <AuthLayout title="Nova senha." text="Defina uma nova senha para sua conta.">
      <form className="auth-form" onSubmit={submit}>
        <label>
          Nova senha
          <span>
            <KeyRound />
            <input name="password" type="password" minLength={8} required />
          </span>
        </label>
        <label>
          Confirmar senha
          <span>
            <LockKeyhole />
            <input name="confirm" type="password" minLength={8} required />
          </span>
        </label>
        <FormMessage error={error} />
        <AsyncButton busy={busy} className="btn primary full">
          Salvar nova senha
        </AsyncButton>
      </form>
    </AuthLayout>
  );
}

export function AuthCallback() {
  const navigate = useNavigate();
  useEffect(() => {
    const timer = window.setTimeout(
      () => navigate("/dashboard", { replace: true }),
      1000,
    );
    return () => window.clearTimeout(timer);
  }, [navigate]);
  return (
    <div className="loading-screen">
      <span className="player-mark">P</span>
      <p>Concluindo acesso…</p>
    </div>
  );
}
