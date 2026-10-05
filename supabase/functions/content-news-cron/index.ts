import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { XMLParser } from "npm:fast-xml-parser@5.11.1";
import { admin, cors, handleError, HttpError, reply } from "../_shared/common.ts";
import { editorialCheck, normalizeNewsItem, stableNewsSlug } from "../_shared/news-editorial.ts";

const CRON_TOKEN_SHA256 = "749f67d3a07654877570e9e1de5cf99a6edc44ea9feb936059457433e6df89bc";
const MAX_ITEMS_PER_SOURCE = 20;
const MAX_FEED_BYTES = 5_000_000;

type SourceRow = {
  id: string;
  name: string;
  slug: string;
  source_type: "rss" | "api" | "partner";
  feed_url: string;
  default_category: string;
  requires_review: boolean;
};

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function requireCron(req: Request) {
  const token = req.headers.get("x-content-hub-cron") || "";
  if (!token || await sha256Hex(token) !== CRON_TOKEN_SHA256) throw new HttpError(401, "INVALID_CRON_TOKEN");
}

function publicFeedUrl(value: string, base?: string) {
  let url: URL;
  try { url = base ? new URL(value, base) : new URL(value); }
  catch { throw new Error("invalid_source_url"); }
  if (url.protocol !== "https:") throw new Error("source_url_must_use_https");
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") ||
    host === "0.0.0.0" || host === "::" || host === "::1" ||
    /^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) || /^100\.(6[4-9]|[78]\d|9\d|1[01]\d|12[0-7])\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    host === "169.254.169.254" || host === "metadata.google.internal"
  ) throw new Error("source_url_not_public");
  return url.toString();
}

async function fetchFeed(url: string, accept: string) {
  let current = publicFeedUrl(url);
  for (let hop = 0; hop < 3; hop += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8_000);
    try {
      const response = await fetch(current, {
        headers: { Accept: accept, "User-Agent": "PontoView-ContentHub-Cron/1.0" },
        redirect: "manual",
        signal: controller.signal,
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) throw new Error(`redirect_${response.status}`);
        current = publicFeedUrl(location, current);
        continue;
      }
      return response;
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error("redirect_limit");
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
  const candidates = [item["media:content"], item["media:thumbnail"], item.enclosure, item.image, item.thumbnail];
  for (const candidate of candidates) {
    for (const entry of asArray(candidate as Record<string, unknown> | Record<string, unknown>[])) {
      if (typeof entry === "string" && /^https?:\/\//i.test(entry)) return entry;
      if (entry && typeof entry === "object") {
        const row = entry as Record<string, unknown>;
        const url = textValue(row["@_url"] || row["@_href"] || row.url || row["#text"]);
        const type = textValue(row["@_type"]);
        if (url && (!type || type.startsWith("image/"))) return url;
      }
    }
  }
  return "";
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
  const rss = parsed.rss as Record<string, unknown> | undefined;
  const channel = rss?.channel as Record<string, unknown> | undefined;
  const feed = parsed.feed as Record<string, unknown> | undefined;
  const rdf = parsed["rdf:RDF"] as Record<string, unknown> | undefined;
  const rows = channel?.item ?? feed?.entry ?? rdf?.item ?? [];
  return asArray(rows as Record<string, unknown> | Record<string, unknown>[])
    .filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object"))
    .map((item) => ({
      title: textValue(item.title),
      description: textValue(item.description ?? item.summary ?? item["content:encoded"] ?? item.content),
      source: sourceName,
      link: linkValue(item.link) || linkValue(item.guid) || linkValue(item.id),
      image: imageValue(item),
      author: textValue(item.author ?? item["dc:creator"] ?? (item.author as Record<string, unknown> | undefined)?.name),
      pubDate: textValue(item.pubDate ?? item.published ?? item.updated ?? item["dc:date"]),
    }));
}

async function providerItems(source: SourceRow) {
  const accept = source.source_type === "rss"
    ? "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5"
    : "application/json";
  const response = await fetchFeed(source.feed_url, accept);
  if (!response.ok) throw new Error(`provider_http_${response.status}`);
  const text = await response.text();
  if (text.length > MAX_FEED_BYTES) throw new Error("provider_feed_too_large");
  if (source.source_type === "rss") return parseRss(text, source.name);
  const json = JSON.parse(text);
  return Array.isArray(json) ? json : Array.isArray(json?.items) ? json.items : [];
}

async function ingest(source: SourceRow) {
  const importedAt = new Date().toISOString();
  try {
    const incoming = (await providerItems(source)).slice(0, MAX_ITEMS_PER_SOURCE);
    if (!incoming.length) throw new Error("provider_empty_feed");

    const rows: Record<string, unknown>[] = [];
    let rejected = 0;
    let invalid = 0;

    for (const raw of incoming) {
      const normalized = normalizeNewsItem(raw);
      if (!normalized) { invalid += 1; continue; }
      const editorial = editorialCheck({
        title: normalized.title,
        summary: normalized.summary,
        source: normalized.source_name,
        url: normalized.source_url,
      });
      if (!editorial.allowed) rejected += 1;
      const category = source.default_category && source.default_category !== "general"
        ? source.default_category
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
        status: editorial.allowed ? "review" : "rejected",
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

    await admin.from("content_sources").update({
      last_ingested_at: importedAt,
      last_ingest_status: invalid ? "partial" : "ok",
      last_ingest_count: inserted,
      last_ingest_error: invalid ? `${invalid} item(ns) inválido(s) ignorado(s)` : null,
    }).eq("id", source.id);

    return { slug: source.slug, ok: true, received: incoming.length, inserted, rejected, invalid };
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 300) : "provider_fetch_failed";
    await admin.from("content_sources").update({
      last_ingested_at: importedAt,
      last_ingest_status: "error",
      last_ingest_count: 0,
      last_ingest_error: message,
    }).eq("id", source.id);
    return { slug: source.slug, ok: false, inserted: 0, error: message };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "METHOD_NOT_ALLOWED" }, 405);
  try {
    await requireCron(req);
    const { data, error } = await admin
      .from("content_sources")
      .select("id,name,slug,source_type,feed_url,default_category,requires_review")
      .eq("is_active", true)
      .in("source_type", ["rss", "api", "partner"])
      .not("feed_url", "is", null)
      .order("name");
    if (error) throw error;

    const results = [];
    for (const source of (data || []) as SourceRow[]) results.push(await ingest(source));

    return reply({
      ok: true,
      sources: results.length,
      succeeded: results.filter((row) => row.ok).length,
      failed: results.filter((row) => !row.ok).length,
      inserted: results.reduce((total, row) => total + Number(row.inserted || 0), 0),
      results,
    });
  } catch (error) {
    return handleError(error);
  }
});
