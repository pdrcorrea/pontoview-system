import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { admin, cors, handleError, reply, requirePlayer } from "../_shared/common.ts";

const TTL = 10 * 60 * 1000;
const key = (lat: number, lon: number) => `${lat.toFixed(4)},${lon.toFixed(4)}`;
const validLat = (value: number) => Number.isFinite(value) && value >= -90 && value <= 90;
const validLon = (value: number) => Number.isFinite(value) && value >= -180 && value <= 180;
const condition = (code: number) => ({
  0: "Céu limpo", 1: "Predomínio de sol", 2: "Parcialmente nublado", 3: "Nublado",
  45: "Neblina", 48: "Neblina", 51: "Garoa leve", 53: "Garoa", 55: "Garoa forte",
  61: "Chuva leve", 63: "Chuva", 65: "Chuva forte", 71: "Neve leve", 73: "Neve",
  75: "Neve forte", 80: "Pancadas de chuva", 81: "Pancadas de chuva", 82: "Pancadas fortes",
  95: "Trovoadas", 96: "Trovoadas com granizo", 99: "Trovoadas com granizo",
} as Record<number, string>)[code] || "Tempo variável";

function citySearchName(value: string) {
  return value.split(/[·,]/)[0]?.trim() || value.trim();
}

async function geocode(name: string) {
  const query = citySearchName(name);
  if (!query) return null;
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", query);
  url.searchParams.set("count", "5");
  url.searchParams.set("language", "pt");
  url.searchParams.set("format", "json");
  url.searchParams.set("countryCode", "BR");
  const response = await fetch(url);
  if (!response.ok) return null;
  const json = await response.json();
  const row = Array.isArray(json?.results) ? json.results[0] : null;
  if (!row) return null;
  const latitude = Number(row.latitude);
  const longitude = Number(row.longitude);
  if (!validLat(latitude) || !validLon(longitude)) return null;
  const state = String(row.admin1 || "").trim();
  return { latitude, longitude, name: [String(row.name || query).trim(), state].filter(Boolean).join(" · ") };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "METHOD_NOT_ALLOWED" }, 405);
  try {
    const manifest = await requirePlayer(req);
    const configured = manifest.settings?.weather_location || manifest.organization?.settings?.weatherLocation || null;
    if (!configured) return reply({ temperature: null, name: "Configure a cidade" });

    let latitude = Number(configured.latitude);
    let longitude = Number(configured.longitude);
    let name = String(configured.name || "").trim();
    if (!validLat(latitude) || !validLon(longitude)) {
      const resolved = await geocode(name);
      if (!resolved) return reply({ temperature: null, name: name || "Cidade inválida", configurationRequired: true });
      latitude = resolved.latitude;
      longitude = resolved.longitude;
      name = resolved.name;
      const screenId = String(manifest.screen?.id || "");
      if (screenId) await admin.from("screen_settings").update({ weather_location: { name, latitude, longitude } }).eq("screen_id", screenId);
    }

    const locationKey = key(latitude, longitude);
    const { data: cached } = await admin.from("weather_cache")
      .select("temperature,apparent_temperature,humidity,wind_speed,weather_code,is_day,temp_min,temp_max,fetched_at")
      .eq("location_key", locationKey).maybeSingle();
    if (cached?.fetched_at && Date.now() - new Date(cached.fetched_at).getTime() < TTL) {
      return reply({ ...cached, name: name || "Clima", condition: condition(Number(cached.weather_code)), cached: true });
    }

    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", String(latitude));
    url.searchParams.set("longitude", String(longitude));
    url.searchParams.set("current", "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,is_day,weather_code,wind_speed_10m");
    url.searchParams.set("daily", "temperature_2m_max,temperature_2m_min");
    url.searchParams.set("timezone", "auto");
    url.searchParams.set("forecast_days", "1");
    const response = await fetch(url);
    if (!response.ok) {
      if (cached) return reply({ ...cached, name: name || "Clima", condition: condition(Number(cached.weather_code)), cached: true, stale: true });
      return reply({ error: "WEATHER_PROVIDER_ERROR" }, 502);
    }
    const json = await response.json();
    const row = {
      location_key: locationKey, latitude, longitude, provider: "open_meteo",
      temperature: json.current?.temperature_2m ?? null,
      apparent_temperature: json.current?.apparent_temperature ?? null,
      humidity: json.current?.relative_humidity_2m ?? null,
      wind_speed: json.current?.wind_speed_10m ?? null,
      weather_code: json.current?.weather_code ?? null,
      is_day: json.current?.is_day === 1,
      temp_min: json.daily?.temperature_2m_min?.[0] ?? null,
      temp_max: json.daily?.temperature_2m_max?.[0] ?? null,
      source_time: json.current?.time ?? null,
      fetched_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await admin.from("weather_cache").upsert(row);
    return reply({ ...row, precipitation: json.current?.precipitation ?? null, name: name || "Clima", condition: condition(Number(row.weather_code)), cached: false });
  } catch (error) {
    return handleError(error);
  }
});
