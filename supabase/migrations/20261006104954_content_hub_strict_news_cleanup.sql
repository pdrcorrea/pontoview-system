update public.content_items
set status = 'rejected',
    editorial_flags = coalesce(editorial_flags, '[]'::jsonb)
      || jsonb_build_array(jsonb_build_object('code', 'clickbait', 'stage', 'strict_cleanup'))
where content_type = 'news'
  and status in ('approved', 'published')
  and (
    lower(extensions.unaccent(coalesce(title, ''))) ~ '(^|[^a-z0-9])(veja|entenda|saiba|confira|descubra|assista|clique|leia|conheca|aprenda|relembre)([^a-z0-9]|$)'
    or lower(extensions.unaccent(coalesce(title, ''))) like '%o que se sabe%'
    or lower(extensions.unaccent(coalesce(title, ''))) like '%o que sabemos%'
    or lower(extensions.unaccent(coalesce(title, ''))) like '%tudo o que voce precisa saber%'
    or lower(extensions.unaccent(coalesce(title, ''))) like '%nao vai acreditar%'
    or lower(extensions.unaccent(coalesce(title, ''))) like '%voce precisa saber%'
    or lower(extensions.unaccent(coalesce(title, ''))) like '%passo a passo%'
  );
