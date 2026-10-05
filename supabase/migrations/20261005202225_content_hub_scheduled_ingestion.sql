create extension if not exists pg_cron;

do $$
declare
  existing_job bigint;
begin
  select jobid into existing_job
  from cron.job
  where jobname = 'content-hub-news-window'
  limit 1;

  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;
end $$;

select cron.schedule(
  'content-hub-news-window',
  '0 7,9,11,13,15,17,19 * * *',
  $job$
    select net.http_post(
      url := 'https://fpdojntvnhiszagczfqr.supabase.co/functions/v1/content-news-cron',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-content-hub-cron', (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'content_hub_cron_token'
          limit 1
        )
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 120000
    ) as request_id;
  $job$
);
