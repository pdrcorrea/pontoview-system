-- PontoView Central de Conteúdo — Fase 3 (Painel editorial)
-- Evita registros duplicados de revisão quando alterações editoriais passam pela Edge Function,
-- que já persiste explicitamente o usuário responsável por cada ação.

create or replace function public.content_log_revision()
returns trigger
language plpgsql
security invoker
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_change_type text := 'update';
begin
  -- Atualizações feitas pelas Edge Functions usam service role e registram a revisão
  -- explicitamente com o usuário autenticado. O trigger fica como proteção para
  -- alterações diretas realizadas em contexto de usuário.
  if v_user_id is null then
    return new;
  end if;

  if old.status is distinct from new.status then
    v_change_type := 'status:' || old.status || '->' || new.status;
  end if;

  insert into public.content_revisions(content_item_id, changed_by, change_type, snapshot)
  values (
    new.id,
    v_user_id,
    v_change_type,
    jsonb_build_object('before', to_jsonb(old), 'after', to_jsonb(new))
  );

  return new;
end;
$$;

create index if not exists content_sources_ingest_health_idx
  on public.content_sources(is_active, last_ingest_status, last_ingested_at desc);

create index if not exists content_items_scheduled_idx
  on public.content_items(published_at asc)
  where status = 'published' and published_at is not null;
