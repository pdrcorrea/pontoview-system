import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { admin, cors, handleError, HttpError, reply, requirePlayer } from "../_shared/common.ts";

const TTL = 10 * 60 * 1000;
const STALE_TTL = 24 * 60 * 60 * 1000;
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

function finiteValue(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function citySearchName(value: string) {
  return value.split(/[·,]/)[0]?.trim() || value.trim();
}

async function fetchJson(url: string, timeoutMs = 7000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`UPSTREAM_${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function geocode(name: string) {
  const query = citySearchName(name);
  if (!query) throw new HttpError(400, "INVALID_WEATHER_LOCATION");
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=8&language=pt&format=json`;
  const payload = await fetchJson(url, 5000);
  const rows = Array.isArray(payload?.results) ? payload.results : [];
  const preferred = rows.find((row: any) => String(row.country_code || "").toUpperCase() === "BR") || rows[0];
  if (!preferred || !validLat(Number(preferred.latitude)) || !validLon(Number(preferred.longitude))) {
    throw new HttpError(400, "WEATHER_LOCATION_NOT_FOUND");
  }
  return {
    name: [preferred.name, preferred.admin1].filter(Boolean).join(", "),
    latitude: Number(preferred.latitude),
    longitude: Number(preferred.longitude),
  };
}

async function resolveLocation(config: Record<string, any>) {
  const name = String(config?.name || "").trim();
  let latitude = finiteValue(config?.latitude);
  let longitude = finiteValue(config?.longitude);
  let resolvedName = name;

  if (latitude === null || longitude === null || !validLat(latitude) || !validLon(longitude)) {
    if (!name) throw new HttpError(400, "INVALID_WEATHER_LOCATION");
    const found = await geocode(name);
    latitude = found.latitude;
    longitude = found.longitude;
    resolvedName = found.name || name;
  }

  if (!validLat(latitude) || !validLon(longitude)) throw new HttpError(400, "INVALID_WEATHER_LOCATION");
  return { name: resolvedName || name || "Local configurado", latitude, longitude };
}

function cachePayload(cache: Record<string, any>, name: string, stale = false) {
  return {
    name,
    temperature: cache.temperature,
    apparent_temperature: cache.apparent_temperature,
    humidity: cache.humidity,
    wind_speed: cache.wind_speed,
    weather_code: cache.weather_code,
    is_day: cache.is_day,
    condition: condition(Number(cache.weather_code)),
    temp_min: cache.temp_min,
    temp_max: cache.temp_max,
    forecast: Array.isArray(cache.forecast) ? cache.forecast : [],
    fetched_at: cache.fetched_at,
    stale,
  };
}

async function loadWeather(location: { name: string; latitude: number; longitude: number }) {
  const locationKey = key(location.latitude, location.longitude);
  const { data: cache } = await admin.from("weather_cache")
    .select("temperature,apparent_temperature,humidity,wind_speed,weather_code,is_day,temp_min,temp_max,forecast,fetched_at")
    .eq("location_key", locationKey)
    .maybeSingle();

  const cacheAge = cache?.fetched_at ? Date.now() - new Date(cache.fetched_at).getTime() : Number.POSITIVE_INFINITY;
  if (cache && cacheAge < TTL) return cachePayload(cache, location.name);

  try {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", String(location.latitude));
    url.searchParams.set("longitude", String(location.longitude));
    url.searchParams.set("current", "temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,is_day");
    url.searchParams.set("daily", "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max");
    url.searchParams.set("timezone", "auto");
    url.searchParams.set("forecast_days", "5");

    const data = await fetchJson(url.toString(), 7000);
    if (!data?.current) throw new Error("WEATHER_UPSTREAM_EMPTY");
    const daily = data.daily || {};
    const forecast = (Array.isArray(daily.time) ? daily.time : []).slice(0, 5).map((date: string, index: number) => ({
      date,
      weather_code: finiteValue(daily.weather_code?.[index]),
      condition: condition(Number(daily.weather_code?.[index] ?? 3)),
      temp_min: finiteValue(daily.temperature_2m_min?.[index]),
      temp_max: finiteValue(daily.temperature_2m_max?.[index]),
      precipitation_probability: finiteValue(daily.precipitation_probability_max?.[index]),
    }));
    const current = data.current;
    const row = {
      location_key: locationKey,
      latitude: location.latitude,
      longitude: location.longitude,
      temperature: finiteValue(current.temperature_2m),
      apparent_temperature: finiteValue(current.apparent_temperature),
      humidity: finiteValue(current.relative_humidity_2m),
      wind_speed: finiteValue(current.wind_speed_10m),
      weather_code: finiteValue(current.weather_code),
      is_day: Number(current.is_day) === 1,
      temp_min: finiteValue(daily.temperature_2m_min?.[0]),
      temp_max: finiteValue(daily.temperature_2m_max?.[0]),
      forecast,
      fetched_at: new Date().toISOString(),
    };
    const { error } = await admin.from("weather_cache").upsert(row, { onConflict: "location_key" });
    if (error) console.error("weather cache upsert", error);
    return cachePayload(row, location.name);
  } catch (error) {
    console.error("weather upstream", error);
    if (cache && cacheAge < STALE_TTL) return cachePayload(cache, location.name, true);
    throw error;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    let config: Record<string, any> = {};
    const hasPlayerAuth = Boolean(req.headers.get("x-screen-id") && req.headers.get("x-screen-token"));
    if (hasPlayerAuth) {
      const manifest = await requirePlayer(req);
      config = manifest?.settings?.weather_location || {};
    } else {
      const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
      config = {
        name: String(body?.name || "").trim(),
        latitude: body?.latitude,
        longitude: body?.longitude,
      };
    }

    const location = await resolveLocation(config);
    return reply(await loadWeather(location), 200, { "Cache-Control": "public, max-age=60" });
  } catch (error) {
    return handleError(error);
  }
});
