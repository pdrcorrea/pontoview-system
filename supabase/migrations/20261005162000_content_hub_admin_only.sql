-- Central de Conteúdo PontoView
-- Acesso editorial inicial restrito ao administrador definido abaixo.

update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) - 'content_hub_role'
where lower(email) <> 'phcorrea97@gmail.com'
  and raw_app_meta_data ? 'content_hub_role';

update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
  || jsonb_build_object('content_hub_role', 'admin')
where lower(email) = 'phcorrea97@gmail.com';
