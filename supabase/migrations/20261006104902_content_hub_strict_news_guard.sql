create or replace function public.content_hub_news_guard()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  title_plain text;
  review_count integer;
  published_count integer;
  oldest_published_id uuid;
begin
  if new.content_type <> 'news' then
    return new;
  end if;

  title_plain := lower(extensions.unaccent(coalesce(new.title, '')));

  if new.status in ('review', 'approved', 'published') and (
    title_plain ~ '(^|[^a-z0-9])(veja|entenda|saiba|confira|descubra|assista|clique|leia|conheca|aprenda|relembre)([^a-z0-9]|$)'
    or title_plain like '%o que se sabe%'
    or title_plain like '%o que sabemos%'
    or title_plain like '%tudo o que voce precisa saber%'
    or title_plain like '%nao vai acreditar%'
    or title_plain like '%voce precisa saber%'
    or title_plain like '%passo a passo%'
  ) then
    if tg_op = 'INSERT' then
      return null;
    end if;

    new.status := 'rejected';
    new.editorial_flags := coalesce(new.editorial_flags, '[]'::jsonb)
      || jsonb_build_array(jsonb_build_object('code', 'clickbait', 'stage', 'database_guard'));
    return new;
  end if;

  if tg_op = 'INSERT' and new.status = 'rejected' then
    return null;
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
    select count(*)::integer
      into published_count
    from public.content_items ci
    where ci.content_type = 'news'
      and ci.status = 'published'
      and ci.category = new.category
      and (tg_op = 'INSERT' or ci.id <> new.id);

    if published_count >= 5 then
      select ci.id
        into oldest_published_id
      from public.content_items ci
      where ci.content_type = 'news'
        and ci.status = 'published'
        and ci.category = new.category
        and (tg_op = 'INSERT' or ci.id <> new.id)
      order by coalesce(ci.published_at, ci.source_published_at, ci.imported_at) asc nulls first
      limit 1;

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

drop trigger if exists content_hub_news_guard_insert on public.content_items;
create trigger content_hub_news_guard_insert
before insert on public.content_items
for each row execute function public.content_hub_news_guard();

drop trigger if exists content_hub_news_guard_update on public.content_items;
create trigger content_hub_news_guard_update
before update of title, status, category on public.content_items
for each row execute function public.content_hub_news_guard();

update public.content_items
set status = 'rejected',
    editorial_flags = coalesce(editorial_flags, '[]'::jsonb)
      || jsonb_build_array(jsonb_build_object('code', 'clickbait', 'stage', 'cleanup'))
where content_type = 'news'
  and status = 'review'
  and (
    lower(extensions.unaccent(coalesce(title, ''))) ~ '(^|[^a-z0-9])(veja|entenda|saiba|confira|descubra|assista|clique|leia|conheca|aprenda|relembre)([^a-z0-9]|$)'
    or lower(extensions.unaccent(coalesce(title, ''))) like '%o que se sabe%'
    or lower(extensions.unaccent(coalesce(title, ''))) like '%o que sabemos%'
    or lower(extensions.unaccent(coalesce(title, ''))) like '%tudo o que voce precisa saber%'
    or lower(extensions.unaccent(coalesce(title, ''))) like '%nao vai acreditar%'
    or lower(extensions.unaccent(coalesce(title, ''))) like '%voce precisa saber%'
    or lower(extensions.unaccent(coalesce(title, ''))) like '%passo a passo%'
  );

with ranked as (
  select id,
         row_number() over (
           partition by category
           order by coalesce(source_published_at, imported_at) desc nulls last, imported_at desc nulls last
         ) as rn
  from public.content_items
  where content_type = 'news'
    and status = 'review'
)
update public.content_items ci
set status = 'archived'
from ranked r
where ci.id = r.id
  and r.rn > 5;

with ranked as (
  select id,
         row_number() over (
           partition by category
           order by coalesce(published_at, source_published_at, imported_at) desc nulls last
         ) as rn
  from public.content_items
  where content_type = 'news'
    and status = 'published'
)
update public.content_items ci
set status = 'archived'
from ranked r
where ci.id = r.id
  and r.rn > 5;
