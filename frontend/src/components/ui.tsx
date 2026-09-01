import { type FormEvent, type ReactNode, useEffect } from "react";
import { AlertCircle, CheckCircle2, Loader2, Plus, X } from "lucide-react";

export function PageHead({
  eyebrow,
  title,
  text,
  action,
  onAction,
}: {
  eyebrow: string;
  title: string;
  text: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="head">
      <div>
        <small>{eyebrow}</small>
        <h1>{title}</h1>
        <p>{text}</p>
      </div>
      {action && (
        <button className="btn primary" onClick={onAction}>
          <Plus size={16} />
          {action}
        </button>
      )}
    </div>
  );
}

export function LoadingScreen({ label = "Carregando" }: { label?: string }) {
  return (
    <div className="loading-screen">
      <span className="player-mark loading-brand-mark">
        <img src="/assets/icon.png" alt="PontoView" />
      </span>
      <Loader2 className="spin" />
      <p>{label}</p>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  text,
  action,
  onAction,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <section className="empty-state panel">
      <span>{icon}</span>
      <h2>{title}</h2>
      <p>{text}</p>
      {action && (
        <button className="btn primary" onClick={onAction}>
          {action}
        </button>
      )}
    </section>
  );
}

export function Modal({
  title,
  eyebrow,
  children,
  onClose,
}: {
  title: string;
  eyebrow?: string;
  children: ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose]);
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <section className="pv-modal" role="dialog" aria-modal="true">
        <div className="modal-head">
          <div>
            {eyebrow && <small>{eyebrow}</small>}
            <h2>{title}</h2>
          </div>
          <button className="icon-button" aria-label="Fechar" onClick={onClose}>
            <X />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

export function FormMessage({
  error,
  success,
}: {
  error?: string | null;
  success?: string | null;
}) {
  if (error)
    return (
      <div className="form-message error">
        <AlertCircle size={17} />
        <span>{error}</span>
      </div>
    );
  if (success)
    return (
      <div className="form-message success">
        <CheckCircle2 size={17} />
        <span>{success}</span>
      </div>
    );
  return null;
}

export function AsyncButton({
  busy,
  children,
  ...props
}: {
  busy?: boolean;
  children: ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...props} disabled={busy || props.disabled}>
      {busy && <Loader2 size={16} className="spin" />}
      {children}
    </button>
  );
}

export function formData(event: FormEvent<HTMLFormElement>) {
  return Object.fromEntries(
    new FormData(event.currentTarget).entries(),
  ) as Record<string, string>;
}

export function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function timeAgo(value?: string | null) {
  if (!value) return "Nunca";
  const seconds = Math.max(
    0,
    Math.round((Date.now() - new Date(value).getTime()) / 1000),
  );
  if (seconds < 60) return `há ${seconds}s`;
  if (seconds < 3600) return `há ${Math.floor(seconds / 60)} min`;
  if (seconds < 86400) return `há ${Math.floor(seconds / 3600)} h`;
  return `há ${Math.floor(seconds / 86400)} dias`;
}
