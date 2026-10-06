update public.content_items ci
set status = 'archived'
where ci.status = 'review'
  and exists (
    select 1
    from public.content_sources cs
    where cs.id = ci.source_id
      and cs.is_active = false
  );

insert into public.content_sources (
  name, slug, source_type, site_url, feed_url, default_content_type, default_category,
  is_active, requires_review, trust_level, attribution_label, license_notes
) values (
  'Metrópoles - Saúde', 'metropoles-saude', 'rss', 'https://www.metropoles.com/saude',
  'https://www.metropoles.com/saude/feed', 'news', 'health', true, false, 4, 'Metrópoles',
  'Usar somente metadados do feed, manchete, fonte e link para a matéria original.'
)
on conflict (slug) do update set
  feed_url = excluded.feed_url,
  default_category = excluded.default_category,
  is_active = true,
  requires_review = false,
  trust_level = excluded.trust_level,
  updated_at = now();
