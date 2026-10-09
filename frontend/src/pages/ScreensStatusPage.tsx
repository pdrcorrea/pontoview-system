import { useState } from "react";
import { CheckCircle2, RefreshCw, Wifi } from "lucide-react";
import { supabase } from "../lib/supabase";
import { ScreensSimplePage } from "./ScreensSimple";

export function ScreensStatusPage() {
  const [checking, setChecking] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const checkStatus = async () => {
    if (checking) return;
    setChecking(true);
    setMessage(null);
    setFailed(false);

    const result = await supabase.rpc("refresh_screen_statuses");
    setChecking(false);

    if (result.error) {
      setFailed(true);
      setMessage("Não foi possível verificar as telas agora.");
      return;
    }

    setMessage("Status atualizado agora.");
    setRefreshKey((value) => value + 1);
  };

  return (
    <>
      <div
        style={{
          position: "fixed",
          right: "clamp(16px, 2vw, 28px)",
          bottom: "clamp(84px, 9vh, 108px)",
          zIndex: 80,
          display: "grid",
          justifyItems: "end",
          gap: 8,
          pointerEvents: "none",
        }}
      >
        {message && (
          <span
            role="status"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              padding: "9px 12px",
              borderRadius: 12,
              background: failed ? "#fff3f1" : "#eff8f4",
              color: failed ? "#9f3f34" : "#2f7059",
              border: "1px solid rgba(31, 54, 73, .10)",
              boxShadow: "0 8px 24px rgba(28, 45, 60, .10)",
              fontSize: 13,
              fontWeight: 700,
              pointerEvents: "auto",
            }}
          >
            <CheckCircle2 size={16} /> {message}
          </span>
        )}

        <button
          type="button"
          className="btn secondary"
          onClick={() => void checkStatus()}
          disabled={checking}
          title="Consultar agora a comunicação das telas"
          style={{
            pointerEvents: "auto",
            boxShadow: "0 10px 28px rgba(28, 45, 60, .14)",
            borderRadius: 14,
          }}
        >
          {checking ? <RefreshCw className="spin" /> : <Wifi />}
          {checking ? "Verificando…" : "Verificar status"}
        </button>
      </div>

      <ScreensSimplePage key={refreshKey} />
    </>
  );
}
