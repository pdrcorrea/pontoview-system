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

export async function invokeFunction<T>(
  name: string,
  body?: unknown,
): Promise<T> {
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
    body: JSON.stringify(body ?? {}),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(
      result.error || result.message || "Não foi possível concluir a operação.",
    );
  return result as T;
}
