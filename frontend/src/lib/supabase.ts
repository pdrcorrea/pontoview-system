import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
export const supabasePublishableKey = (import.meta.env
  .VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY) as
  | string
  | undefined;

export const isSupabaseConfigured = Boolean(url && supabasePublishableKey);

export const supabase = createClient(
  url || "https://configuration-required.invalid",
  supabasePublishableKey || "configuration-required",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "pkce",
    },
  },
);

export const functionsUrl = url ? `${url}/functions/v1` : "";

type CachedFunctionResult = {
  expiresAt: number;
  value: unknown;
};

const functionReadCache = new Map<string, CachedFunctionResult>();
const functionReadInFlight = new Map<string, Promise<unknown>>();

function editorialReadCacheMs(name: string, body: unknown) {
  if (name !== "content-editorial" || !body || typeof body !== "object") return 0;
  const action = String((body as { action?: unknown }).action || "");
  if (action === "dashboard" || action === "list_sources") return 1_000;
  if (action === "list_items") return 500;
  return 0;
}

function invalidateEditorialReadCache() {
  for (const key of functionReadCache.keys()) {
    if (key.startsWith("content-editorial:")) functionReadCache.delete(key);
  }
}

export async function invokeFunction<T>(
  name: string,
  body?: unknown,
): Promise<T> {
  const payload = body ?? {};
  const cacheMs = editorialReadCacheMs(name, payload);
  const cacheKey = cacheMs > 0 ? `${name}:${JSON.stringify(payload)}` : "";

  if (cacheKey) {
    const cached = functionReadCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.value as T;
    if (cached) functionReadCache.delete(cacheKey);

    const pending = functionReadInFlight.get(cacheKey);
    if (pending) return pending as Promise<T>;
  }

  const request = (async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const response = await fetch(`${functionsUrl}/${name}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabasePublishableKey || "",
        ...(session?.access_token
          ? { Authorization: `Bearer ${session.access_token}` }
          : {}),
      },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new Error(
        result.error || result.message || "Não foi possível concluir a operação.",
      );

    if (cacheKey) {
      functionReadCache.set(cacheKey, {
        expiresAt: Date.now() + cacheMs,
        value: result,
      });
    } else if (name === "content-editorial" || name === "content-news-ingest") {
      invalidateEditorialReadCache();
    }

    return result as T;
  })();

  if (cacheKey) functionReadInFlight.set(cacheKey, request);
  try {
    return await request;
  } finally {
    if (cacheKey) functionReadInFlight.delete(cacheKey);
  }
}
