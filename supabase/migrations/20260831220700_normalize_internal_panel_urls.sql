update public.media
set page_url = regexp_replace(
  page_url,
  '^https://(?:pontoview-system\.pages\.dev|telas\.pontoview\.com\.br)',
  ''
),
updated_at = now()
where type = 'webpage'
  and (
    page_url like 'https://pontoview-system.pages.dev/paineis/%'
    or page_url like 'https://telas.pontoview.com.br/paineis/%'
  );
