create or replace function public.content_hub_news_guard()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  title_plain text;
  url_plain text;
  review_count integer;
  published_count integer;
  oldest_published_id uuid;
  oldest_source_published_at timestamptz;
  source_requires_review boolean := true;
  source_trust smallint := 0;
begin
  if new.content_type <> 'news' then
    return new;
  end if;

  title_plain := lower(extensions.unaccent(coalesce(new.title, '')));
  url_plain := lower(coalesce(new.source_url, ''));

  if new.source_id is not null then
    select coalesce(cs.requires_review, true), coalesce(cs.trust_level, 0)
      into source_requires_review, source_trust
    from public.content_sources cs
    where cs.id = new.source_id;
  end if;

  if new.status in ('review', 'approved', 'published') and (
    title_plain ~ '(^|[^a-z0-9])(veja|entenda|saiba|confira|descubra|assista|clique|leia|conheca|aprenda|relembre)([^a-z0-9]|$)'
    or title_plain like '%o que se sabe%'
    or title_plain like '%o que sabemos%'
    or title_plain like '%tudo o que voce precisa saber%'
    or title_plain like '%nao vai acreditar%'
    or title_plain like '%voce precisa saber%'
    or title_plain like '%passo a passo%'
    or title_plain like '%onde assistir%'
    or title_plain like '%melhores momentos%'
    or title_plain ~ '^ao vivo([^a-z0-9]|$)'
    or title_plain ~ '\?$'
    or url_plain like '%/opiniao/%'
    or url_plain like '%/opiniao-%'
    or url_plain like '%/coluna/%'
    or url_plain like '%/colunas/%'
    or url_plain like '%/blog/%'
    or url_plain like '%/blogs/%'
  ) then
    if tg_op = 'INSERT' then
      return null;
    end if;

    new.status := 'rejected';
    new.editorial_flags := coalesce(new.editorial_flags, '[]'::jsonb)
      || jsonb_build_array(jsonb_build_object('code', 'strict_editorial_filter', 'stage', 'database_guard'));
    return new;
  end if;

  if new.status in ('review', 'approved', 'published')
     and new.source_published_at is not null
     and new.source_published_at < now() - interval '36 hours' then
    if tg_op = 'INSERT' then
      return null;
    end if;
    new.status := 'archived';
    return new;
  end if;

  if tg_op = 'INSERT' and new.status = 'rejected' then
    return null;
  end if;

  if new.status in ('review', 'approved')
     and source_requires_review = false
     and source_trust >= 3 then
    new.status := 'published';
    new.reviewed_at := coalesce(new.reviewed_at, now());
    new.published_at := coalesce(new.published_at, now());
    new.expires_at := coalesce(new.expires_at, coalesce(new.source_published_at, now()) + interval '36 hours');
  end if;

  if new.status = 'review' then
    select count(*)::integer
      into review_count
    from public.content_items ci
    where ci.content_type = 'news'
      and ci.status = 'review'
      and ci.category = new.category
      and (tg_op = 'INSERT' or ci.id <> new.id);

    if review_count >= 5 then
      return null;
    end if;
  end if;

  if new.status = 'published' then
    new.reviewed_at := coalesce(new.reviewed_at, now());
    new.published_at := coalesce(new.published_at, now());
    new.expires_at := coalesce(new.expires_at, coalesce(new.source_published_at, now()) + interval '36 hours');

    select count(*)::integer
      into published_count
    from public.content_items ci
    where ci.content_type = 'news'
      and ci.status = 'published'
      and ci.category = new.category
      and (tg_op = 'INSERT' or ci.id <> new.id);

    if published_count >= 5 then
      select ci.id, coalesce(ci.source_published_at, ci.published_at, ci.imported_at)
        into oldest_published_id, oldest_source_published_at
      from public.content_items ci
      where ci.content_type = 'news'
        and ci.status = 'published'
        and ci.category = new.category
        and (tg_op = 'INSERT' or ci.id <> new.id)
      order by coalesce(ci.source_published_at, ci.published_at, ci.imported_at) asc nulls first
      limit 1;

      if oldest_published_id is not null
         and oldest_source_published_at is not null
         and coalesce(new.source_published_at, new.published_at, now()) <= oldest_source_published_at then
        if tg_op = 'INSERT' then
          return null;
        end if;
        new.status := 'archived';
        return new;
      end if;

      if oldest_published_id is not null then
        update public.content_items
        set status = 'archived'
        where id = oldest_published_id;
      end if;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.content_hub_news_guard() from public, anon, authenticated;
grant execute on function public.content_hub_news_guard() to service_role;

update public.content_sources
set requires_review = false,
    updated_at = now()
where is_active = true
  and trust_level >= 3;

insert into public.content_sources (
  name, slug, source_type, site_url, feed_url, default_content_type, default_category,
  is_active, requires_review, trust_level, attribution_label, license_notes
) values
  ('UOL Notícias', 'uol-noticias', 'rss', 'https://www.uol.com.br/', 'https://rss.uol.com.br/feed/noticias.xml', 'news', 'general', true, false, 4, 'UOL', 'Usar somente metadados do feed, manchete, fonte e link para a matéria original.'),
  ('CNN Brasil', 'cnn-brasil', 'rss', 'https://www.cnnbrasil.com.br/', 'https://admin.cnnbrasil.com.br/feed/', 'news', 'general', true, false, 4, 'CNN Brasil', 'Usar somente metadados do feed, manchete, fonte e link para a matéria original.'),
  ('BBC News Brasil', 'bbc-news-brasil', 'rss', 'https://www.bbc.com/portuguese', 'https://feeds.bbci.co.uk/portuguese/rss.xml', 'news', 'international', true, false, 5, 'BBC News Brasil', 'Usar somente metadados do feed, manchete, fonte e link para a matéria original; preservar atribuição.'),
  ('DW Brasil', 'dw-brasil', 'rss', 'https://www.dw.com/pt-br/', 'https://rss.dw.com/rdf/rss-br-top', 'news', 'international', true, false, 5, 'DW Brasil', 'Usar somente metadados do feed, manchete, fonte e link para a matéria original.'),
  ('Metrópoles - Brasil', 'metropoles-brasil', 'rss', 'https://www.metropoles.com/', 'https://www.metropoles.com/brasil/feed', 'news', 'national', true, false, 4, 'Metrópoles', 'Usar somente metadados do feed, manchete, fonte e link para a matéria original.'),
  ('R7 Notícias', 'r7-noticias', 'rss', 'https://noticias.r7.com/', 'https://noticias.r7.com/feed.xml', 'news', 'general', true, false, 4, 'R7', 'Usar somente metadados do feed, manchete, fonte e link para a matéria original.')
on conflict (slug) do update set
  name = excluded.name,
  source_type = excluded.source_type,
  site_url = excluded.site_url,
  feed_url = excluded.feed_url,
  default_content_type = excluded.default_content_type,
  default_category = excluded.default_category,
  is_active = excluded.is_active,
  requires_review = excluded.requires_review,
  trust_level = excluded.trust_level,
  attribution_label = excluded.attribution_label,
  license_notes = excluded.license_notes,
  updated_at = now();

update public.content_items ci
set status = 'approved'
where ci.status in ('review', 'approved')
  and exists (
    select 1
    from public.content_sources cs
    where cs.id = ci.source_id
      and cs.is_active = true
      and cs.requires_review = false
      and cs.trust_level >= 3
  );
