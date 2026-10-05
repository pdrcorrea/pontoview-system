import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { admin, cors, handleError, HttpError, reply } from "../_shared/common.ts";
import { editorialCheck, normalizeNewsItem, stableNewsSlug } from "../_shared/news-editorial.ts";

const SOURCE_SLUG = "pontoview-news-provider";

function requireIngestSecret(req: Request) {
  const configured = Deno.env.get("CONTENT_HUB_INGEST_SECRET") || "";
  const received = req.headers.get("x-content-hub-secret") || "";
  if (!configured) throw new HttpError(503, "CONTENT_HUB_INGEST_SECRET_MISSING");
  if (!received || received !== configured) throw new HttpError(401, "INVALID_INGEST_SECRET");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "METHOD_NOT_ALLOWED" }, 405);

  try {
    requireIngestSecret(req);

    const { data: source, error: sourceError } = await admin
      .from("content_sources")
      .select("id,name,feed_url,is_active,requires_review")
      .eq("slug", SOURCE_SLUG)
      .maybeSingle();

    if (sourceError) throw sourceError;
    if (!source || !source.is_active || !source.feed_url) throw new HttpError(503, "NEWS_SOURCE_UNAVAILABLE");

    let providerItems: Record<string, unknown>[] = [];
    try {
      const response = await fetch(source.feed_url, {
        headers: { Accept: "application/json", "User-Agent": "PontoView-ContentHub/2.0" },
      });
      if (!response.ok) throw new Error(`provider_http_${response.status}`);
      const json = await response.json();
      providerItems = Array.isArray(json) ? json : Array.isArray(json?.items) ? json.items : [];
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

      rows.push({
        source_id: source.id,
        content_type: "news",
        category: normalized.category,
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
      source: SOURCE_SLUG,
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
