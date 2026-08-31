import { useEffect, useState } from "react";
import { functionsUrl, supabase, supabasePublishableKey } from "../lib/supabase";

export function DriveThumbnail({ mediaId }: { mediaId: string }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;

    const load = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token || !functionsUrl) return;

      const response = await fetch(`${functionsUrl}/drive-thumbnail`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabasePublishableKey || "",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ mediaId }),
      });
      if (!response.ok) return;

      const blob = await response.blob();
      objectUrl = URL.createObjectURL(blob);
      if (active) setSrc(objectUrl);
    };

    void load();
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [mediaId]);

  return src ? <img src={src} alt="" loading="lazy" /> : null;
}
