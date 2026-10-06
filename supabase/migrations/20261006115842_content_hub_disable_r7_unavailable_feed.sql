update public.content_sources
set is_active = false,
    updated_at = now()
where slug = 'r7-noticias'
  and last_ingest_status = 'error';
