const VIDEO_ID = /^[A-Za-z0-9_-]{6,20}$/;

export function extractYouTubeId(value: string): string | null {
  const input = value.trim();
  if (VIDEO_ID.test(input)) return input;
  try {
    const url = new URL(input.startsWith("http") ? input : `https://${input}`);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    let candidate: string | null = null;
    if (host === "youtu.be")
      candidate = url.pathname.split("/").filter(Boolean)[0] || null;
    if (host.endsWith("youtube.com")) {
      candidate = url.searchParams.get("v");
      if (!candidate) {
        const parts = url.pathname.split("/").filter(Boolean);
        const marker = parts.findIndex((part) =>
          ["shorts", "live", "embed"].includes(part),
        );
        if (marker >= 0) candidate = parts[marker + 1] || null;
      }
    }
    return candidate && VIDEO_ID.test(candidate) ? candidate : null;
  } catch {
    return null;
  }
}

export function formatDuration(seconds: number | null | undefined) {
  if (!seconds) return "Automática";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return [hours || null, minutes, secs]
    .filter((part) => part !== null)
    .map((part, index) =>
      index === 0 && !hours ? String(part) : String(part).padStart(2, "0"),
    )
    .join(":");
}
