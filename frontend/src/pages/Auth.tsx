import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Building2,
  Check,
  KeyRound,
  LockKeyhole,
  Mail,
  UserRound,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { AsyncButton, FormMessage, formData } from "../components/ui";

function AuthLayout({
  title,
  text,
  children,
}: {
  title: string;
  text: string;
  children: React.ReactNode;
}) {
  return (
    <div className="auth-page">
      <section className="auth-brand">
        <div className="brand">
          <b>P</b>
          <span>
            <strong>PontoView</strong>
            <small>Screens</small>
          </span>
        </div>
        <div>
          <small>MÍDIA INDOOR, DO SEU JEITO</small>
          <h1>
            Conteúdo certo.
            <br />
            Na tela certa.
            <br />
            Na hora certa.
          </h1>
          <p>
            Gerencie mídias, playlists, programações e telas em um só lugar.
          </p>
        </div>
        <ul>
          <li>
            <Check />
            Arquivos no seu Google Drive
          </li>
          <li>
            <Check />
            YouTube integrado às playlists
          </li>
          <li>
            <Check />
            Player com operação offline
          </li>
        </ul>
      </section>
      <main className="auth-card">
        <div>
          <h2>{title}</h2>
          <p>{text}</p>
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
    <AuthLayout
      title="Acesse sua conta"
      text="Entre para gerenciar suas telas PontoView."
    >
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
        <Link className="forgot" to="/recuperar-senha">
          Esqueci minha senha
        </Link>
        <FormMessage error={error} />
        <AsyncButton busy={busy} className="btn primary full">
          Entrar
        </AsyncButton>
      </form>
      <p className="auth-switch">
        Ainda não tem conta? <Link to="/cadastro">Começar agora</Link>
      </p>
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
      <AuthLayout
        title="Confirme seu e-mail"
        text="Enviamos um link seguro para concluir seu cadastro."
      >
        <div className="auth-success">
          <Mail />
          <p>Abra o e-mail de confirmação e volte para a PontoView.</p>
        </div>
        <Link className="btn secondary full" to="/login">
          Voltar ao login
        </Link>
      </AuthLayout>
    );
  return (
    <AuthLayout
      title="Crie sua conta"
      text="Comece o período de avaliação da PontoView."
    >
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
      <p className="auth-switch">
        Já tem uma conta? <Link to="/login">Entrar</Link>
      </p>
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
    <AuthLayout
      title="Recupere sua senha"
      text="Informe seu e-mail para receber o link seguro."
    >
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
    <AuthLayout
      title="Defina a nova senha"
      text="Escolha uma senha segura para sua conta."
    >
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
      <p>Concluindo acesso seguro…</p>
    </div>
  );
}
