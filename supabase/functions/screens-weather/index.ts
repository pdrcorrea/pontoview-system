import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { admin, cors, handleError, HttpError, reply, requirePlayer } from "../_shared/common.ts";

const TTL = 10 * 60 * 1000;
const STALE_TTL = 24 * 60 * 60 * 1000;
const ALERTS_URL = "https://apiprevmet3.inmet.gov.br/avisos/ativos";
const ALERTS_TTL = 10 * 60 * 1000;

let alertsCache: { at: number; rows: Record<string, any>[] } | null = null;
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

function normalizeText(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function parseAlertGeometry(raw: unknown): Record<string, any> | null {
  if (!raw) return null;
  try {
    const geometry = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (geometry && typeof geometry === "object" && geometry.type && geometry.coordinates) return geometry;
  } catch {}
  return null;
}

function pointInRing(longitude: number, latitude: number, ring: unknown) {
  if (!Array.isArray(ring) || ring.length < 3) return false;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const current = ring[i];
    const previous = ring[j];
    if (!Array.isArray(current) || !Array.isArray(previous)) continue;
    const xi = Number(current[0]), yi = Number(current[1]);
    const xj = Number(previous[0]), yj = Number(previous[1]);
    if (![xi, yi, xj, yj].every(Number.isFinite)) continue;
    const intersects = (yi > latitude) !== (yj > latitude)
      && longitude < ((xj - xi) * (latitude - yi)) / ((yj - yi) || Number.EPSILON) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function pointInAlertGeometry(longitude: number, latitude: number, geometry: Record<string, any>) {
  const type = String(geometry?.type || "");
  const coordinates = geometry?.coordinates;
  if (type === "Polygon" && Array.isArray(coordinates)) {
    return coordinates.some((ring: unknown) => pointInRing(longitude, latitude, ring));
  }
  if (type === "MultiPolygon" && Array.isArray(coordinates)) {
    return coordinates.some((polygon: unknown) =>
      Array.isArray(polygon) && polygon.some((ring: unknown) => pointInRing(longitude, latitude, ring))
    );
  }
  return false;
}

function alertTouchesLocation(alert: Record<string, any>, location: { name: string; latitude: number; longitude: number }) {
  const geometry = parseAlertGeometry(alert?.poligono);
  if (geometry && pointInAlertGeometry(location.longitude, location.latitude, geometry)) return true;

  const city = normalizeText(citySearchName(location.name));
  const municipalities = normalizeText(alert?.municipios);
  if (!city || !municipalities) return false;
  return municipalities.includes(`${city} - `) || municipalities.startsWith(`${city} - `);
}

function severityRank(value: unknown) {
  const severity = normalizeText(value);
  if (severity.includes("grande perigo")) return 3;
  if (severity === "perigo" || severity.includes("perigo")) return 2;
  if (severity.includes("potencial")) return 1;
  return 0;
}

function toStringArray(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean);
  if (value === null || value === undefined || value === "") return [];
  return [String(value).trim()].filter(Boolean);
}

function normalizeOfficialAlert(alert: Record<string, any>) {
  const risks = toStringArray(alert?.riscos);
  return {
    id: alert?.id_aviso ?? alert?.id ?? null,
    official: true,
    source: "INMET",
    title: String(alert?.descricao || "Aviso meteorológico").trim(),
    severity: String(alert?.severidade || "").trim(),
    level: severityRank(alert?.severidade),
    color: String(alert?.aviso_cor || "").trim() || null,
    description: risks[0] || "",
    starts_at: alert?.inicio ?? null,
    ends_at: alert?.fim ?? null,
  };
}

async function loadOfficialAlerts(location: { name: string; latitude: number; longitude: number }) {
  try {
    const now = Date.now();
    let rows = alertsCache && now - alertsCache.at < ALERTS_TTL ? alertsCache.rows : null;

    if (!rows) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      try {
        const response = await fetch(ALERTS_URL, {
          signal: controller.signal,
          headers: {
            Accept: "application/json",
            "User-Agent": "PontoView-Telas/1.0",
          },
        });
        if (!response.ok) throw new Error(`INMET_ALERTS_${response.status}`);
        const payload = await response.json();
        rows = [
          ...(Array.isArray(payload?.hoje) ? payload.hoje : []),
        ];
        alertsCache = { at: now, rows };
      } finally {
        clearTimeout(timer);
      }
    }

    return rows
      .filter((alert) => alertTouchesLocation(alert, location))
      .map(normalizeOfficialAlert)
      .sort((a, b) => b.level - a.level)
      .slice(0, 2);
  } catch (error) {
    console.error("INMET alerts", error);
    return [];
  }
}

async function attachOfficialAlerts(payload: Record<string, any>, location: { name: string; latitude: number; longitude: number }) {
  return {
    ...payload,
    alerts: await loadOfficialAlerts(location),
  };
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
  if (cache && cacheAge < TTL) return attachOfficialAlerts(cachePayload(cache, location.name), location);

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
    return attachOfficialAlerts(cachePayload(row, location.name), location);
  } catch (error) {
    console.error("weather upstream", error);
    if (cache && cacheAge < STALE_TTL) return attachOfficialAlerts(cachePayload(cache, location.name, true), location);
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
