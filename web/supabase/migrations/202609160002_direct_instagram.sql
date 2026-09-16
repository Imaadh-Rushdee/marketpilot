begin;
alter table public.social_connections drop constraint if exists social_connections_provider_check;
alter table public.social_connections add constraint social_connections_provider_check check (provider in ('meta','instagram','tiktok'));
commit;
notify pgrst, 'reload schema';
