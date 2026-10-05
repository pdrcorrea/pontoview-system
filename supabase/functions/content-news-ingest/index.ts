import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { XMLParser } from "npm:fast-xml-parser@5.11.1";
import { admin, cors, handleError, HttpError, reply, requireUser } from "../_shared/common.ts";
import { editorialCheck, normalizeNewsItem, stableNewsSlug } from "../_shared/news-editorial.ts";

const DEFAULT_SOURCE_SLUG = "pontoview-news-provider";
const editorialRoles = new Set(["admin", "editor"]);
const MAX_FEED_BYTES = 5_000_000;

async function requireIngestAccess(req: Request) {
  const configured = Deno.env.get("CONTENT_HUB_INGEST_SECRET") || "";
  const received = req.headers.get("x-content-hub-secret") || "";
  if (configured && received && received === configured) return { mode: "secret" as const };

  const user = await requireUser(req);
  const role = String(user.app_metadata?.content_hub_role || "");
  if (!editorialRoles.has(role)) throw new HttpError(403, "CONTENT_HUB_ACCESS_DENIED");
  return { mode: "user" as const, user, role };
}

function publicFeedUrl(value: string, base?: string) {
  let url: URL;
  try { url = base ? new URL(value, base) : new URL(value); }
  catch { throw new HttpError(400, "INVALID_SOURCE_URL"); }

  if (url.protocol !== "https:") throw new HttpError(400, "SOURCE_URL_MUST_USE_HTTPS");
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") ||
    host === "0.0.0.0" || host === "::" || host === "::1" ||
    /^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) || /^100\.(6[4-9]|[78]\d|9\d|1[01]\d|12[0-7])\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    host === "169.254.169.254" || host === "metadata.google.internal"
  ) throw new HttpError(400, "SOURCE_URL_NOT_PUBLIC");

  return url.toString();
}

async function fetchPublicFeed(url: string, accept: string) {
  let current = publicFeedUrl(url);
  for (let hop = 0; hop < 3; hop += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);
    let response: Response;
    try {
      response = await fetch(current, {
        headers: { Accept: accept, "User-Agent": "PontoView-ContentHub/4.0" },
        redirect: "manual",
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error(`provider_redirect_${response.status}`);
      current = publicFeedUrl(location, current);
      continue;
    }
    return response;
  }
  throw new Error("provider_redirect_limit");
}

function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function textValue(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(textValue).find(Boolean) || "";
  if (typeof value === "object") {
    const row = value as Record<string, unknown>;
    return textValue(row["#text"] ?? row["#cdata"] ?? row["_"] ?? row["value"] ?? "");
  }
  return "";
}

function linkValue(value: unknown): string {
  if (typeof value === "string") return value;
  for (const candidate of asArray(value as Record<string, unknown> | Record<string, unknown>[])) {
    if (!candidate || typeof candidate !== "object") continue;
    const row = candidate as Record<string, unknown>;
    const rel = textValue(row["@_rel"]);
    const href = textValue(row["@_href"] || row["@_url"] || row["#text"]);
    if (href && (!rel || rel === "alternate")) return href;
  }
  return textValue(value);
}

function imageValue(item: Record<string, unknown>): string {
  const candidates = [
    item["media:content"], item["media:thumbnail"], item["enclosure"], item["image"], item["thumbnail"],
  ];
  for (const candidate of candidates) {
    for (const entry of asArray(candidate as Record<string, unknown> | Record<string, unknown>[])) {
      if (typeof entry === "string" && /^https?:\/\//i.test(entry)) return entry;
      if (entry && typeof entry === "object") {
        const row = entry as Record<string, unknown>;
        const url = textValue(row["@_url"] || row["@_href"] || row["url"] || row["#text"]);
        const type = textValue(row["@_type"]);
        if (url && (!type || type.startsWith("image/"))) return url;
      }
    }
  }
  return "";
}

function mapRssItem(item: Record<string, unknown>, sourceName: string) {
  const link = linkValue(item.link) || linkValue(item.guid) || linkValue(item.id);
  return {
    title: textValue(item.title),
    description: textValue(item.description ?? item.summary ?? item["content:encoded"] ?? item.content),
    source: sourceName,
    link,
    image: imageValue(item),
    author: textValue(item.author ?? item["dc:creator"] ?? (item.author as Record<string, unknown> | undefined)?.name),
    pubDate: textValue(item.pubDate ?? item.published ?? item.updated ?? item["dc:date"]),
  };
}

function parseRss(xml: string, sourceName: string): Record<string, unknown>[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    trimValues: true,
    parseTagValue: false,
    parseAttributeValue: false,
    processEntities: false,
  });
  const parsed = parser.parse(xml) as Record<string, unknown>;
  const rss = parsed?.rss as Record<string, unknown> | undefined;
  const channel = rss?.channel as Record<string, unknown> | undefined;
  const feed = parsed?.feed as Record<string, unknown> | undefined;
  const rdf = parsed?.["rdf:RDF"] as Record<string, unknown> | undefined;
  const rows = channel?.item ?? feed?.entry ?? rdf?.item ?? [];
  return asArray(rows as Record<string, unknown> | Record<string, unknown>[])
    .filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object"))
    .map((row) => mapRssItem(row, sourceName));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "METHOD_NOT_ALLOWED" }, 405);

  try {
    await requireIngestAccess(req);
    const body = await req.json().catch(() => ({}));
    const sourceSlug = String(body?.source_slug || DEFAULT_SOURCE_SLUG).trim().slice(0, 100) || DEFAULT_SOURCE_SLUG;

    const { data: source, error: sourceError } = await admin
      .from("content_sources")
      .select("id,name,slug,source_type,feed_url,default_category,is_active,requires_review")
      .eq("slug", sourceSlug)
      .maybeSingle();

    if (sourceError) throw sourceError;
    if (!source || !source.is_active || !source.feed_url) throw new HttpError(503, "NEWS_SOURCE_UNAVAILABLE");
    if (!["api", "partner", "rss"].includes(String(source.source_type))) throw new HttpError(409, "SOURCE_INGESTION_NOT_SUPPORTED_YET");
    const feedUrl = publicFeedUrl(String(source.feed_url));

    let providerItems: Record<string, unknown>[] = [];
    try {
      if (source.source_type === "rss") {
        const response = await fetchPublicFeed(feedUrl, "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5");
        if (!response.ok) throw new Error(`provider_http_${response.status}`);
        const xml = await response.text();
        if (xml.length > MAX_FEED_BYTES) throw new Error("provider_feed_too_large");
        providerItems = parseRss(xml, String(source.name));
      } else {
        const response = await fetchPublicFeed(feedUrl, "application/json");
        if (!response.ok) throw new Error(`provider_http_${response.status}`);
        const text = await response.text();
        if (text.length > MAX_FEED_BYTES) throw new Error("provider_feed_too_large");
        const json = JSON.parse(text);
        providerItems = Array.isArray(json) ? json : Array.isArray(json?.items) ? json.items : [];
      }
      if (!providerItems.length) throw new Error("provider_empty_feed");
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 500) : "provider_fetch_failed";
      await admin.from("content_sources").update({
        last_ingested_at: new Date().toISOString(),
        last_ingest_status: "error",
        last_ingest_count: 0,
        last_ingest_error: message,
      }).eq("id", source.id);
      throw new HttpError(502, "NEWS_PROVIDER_UNAVAILABLE");
    }

    const importedAt = new Date().toISOString();
    const rows: Record<string, unknown>[] = [];
    let invalid = 0;
    let rejected = 0;
    let queued = 0;

    for (const raw of providerItems.slice(0, 120)) {
      const normalized = normalizeNewsItem(raw);
      if (!normalized) {
        invalid += 1;
        continue;
      }

      const editorial = editorialCheck({
        title: normalized.title,
        summary: normalized.summary,
        source: normalized.source_name,
        url: normalized.source_url,
      });
      const status = editorial.allowed ? (source.requires_review ? "review" : "approved") : "rejected";
      if (editorial.allowed) queued += 1;
      else rejected += 1;

      const category = source.default_category && source.default_category !== "general"
        ? String(source.default_category)
        : normalized.category;

      rows.push({
        source_id: source.id,
        content_type: "news",
        category,
        slug: await stableNewsSlug(normalized.title, normalized.source_url),
        title: normalized.title,
        summary: normalized.summary,
        image_url: normalized.image_url,
        source_name: normalized.source_name,
        source_url: normalized.source_url,
        source_author: normalized.source_author,
        source_published_at: normalized.source_published_at,
        status,
        editorial_flags: editorial.allowed ? [] : [{ code: editorial.reason, stage: "ingestion" }],
        imported_at: importedAt,
      });
    }

    let inserted = 0;
    if (rows.length) {
      const { data, error } = await admin
        .from("content_items")
        .upsert(rows, { onConflict: "source_id,source_url", ignoreDuplicates: true })
        .select("id");
      if (error) throw error;
      inserted = data?.length || 0;
    }

    const status = invalid > 0 ? "partial" : "ok";
    await admin.from("content_sources").update({
      last_ingested_at: importedAt,
      last_ingest_status: status,
      last_ingest_count: inserted,
      last_ingest_error: invalid > 0 ? `${invalid} item(ns) inválido(s) ignorado(s)` : null,
    }).eq("id", source.id);

    return reply({
      source: source.slug,
      received: providerItems.length,
      considered: rows.length,
      inserted,
      queued,
      rejected,
      invalid,
      duplicate_or_existing: Math.max(0, rows.length - inserted),
    });
  } catch (error) {
    return handleError(error);
  }
});
