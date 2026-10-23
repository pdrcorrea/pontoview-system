-- Mantem os feeds editoriais do g1 versionados junto ao motor da Central de Conteudo.
-- A coleta existente le automaticamente fontes ativas de public.content_sources.
-- Operacao idempotente: nao altera nenhuma outra fonte e nao cria feeds duplicados.

insert into public.content_sources (
  name, slug, source_type, site_url, feed_url,
  default_content_type, default_category, is_active,
  requires_review, trust_level, attribution_label, license_notes
) values
  ('G1 Educação', 'g1-educacao', 'rss', 'https://g1.globo.com/educacao/', 'https://g1.globo.com/rss/g1/educacao/', 'news', 'education', true, false, 4, 'g1', 'Utilizar somente metadados permitidos, manchete, fonte e link para a matéria original.'),
  ('G1 Economia', 'g1-economia', 'rss', 'https://g1.globo.com/economia/', 'https://g1.globo.com/rss/g1/economia/', 'news', 'economy', true, false, 4, 'g1', 'Utilizar somente metadados permitidos, manchete, fonte e link para a matéria original.'),
  ('G1 Mundo', 'g1-mundo', 'rss', 'https://g1.globo.com/mundo/', 'https://g1.globo.com/rss/g1/mundo/', 'news', 'international', true, false, 4, 'g1', 'Utilizar somente metadados permitidos, manchete, fonte e link para a matéria original.'),
  ('G1 Turismo e Viagem', 'g1-turismo-viagem', 'rss', 'https://g1.globo.com/turismo-e-viagem/', 'https://g1.globo.com/rss/g1/turismo-e-viagem/', 'news', 'tourism', true, false, 4, 'g1', 'Utilizar somente metadados permitidos, manchete, fonte e link para a matéria original.')
on conflict (slug) do update set
  name = excluded.name,
  source_type = excluded.source_type,
  site_url = excluded.site_url,
  feed_url = excluded.feed_url,
  default_content_type = excluded.default_content_type,
  default_category = excluded.default_category,
  is_active = true,
  requires_review = excluded.requires_review,
  trust_level = excluded.trust_level,
  attribution_label = excluded.attribution_label,
  license_notes = excluded.license_notes,
  updated_at = now();
