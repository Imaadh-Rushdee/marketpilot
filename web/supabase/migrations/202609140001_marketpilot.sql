-- Run once in your Supabase project's SQL editor, or with supabase db push.
begin;

create table public.user_workspaces (
  user_id uuid primary key references auth.users(id) on delete cascade,
  profile jsonb not null check (jsonb_typeof(profile) = 'object'),
  campaigns jsonb not null default '[]'::jsonb check (jsonb_typeof(campaigns) = 'array'),
  revision integer not null default 0 check (revision >= 0),
  updated_at timestamptz not null default now()
);

alter table public.user_workspaces enable row level security;
revoke all on public.user_workspaces from anon, authenticated;
grant select, insert, update on public.user_workspaces to authenticated;

create policy "Read own workspace" on public.user_workspaces
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Insert own workspace" on public.user_workspaces
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Update own workspace" on public.user_workspaces
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Compare-and-swap prevents a stale browser/device from overwriting newer edits.
create function public.save_marketpilot_workspace(
  p_profile jsonb, p_campaigns jsonb, p_expected_revision integer
) returns table(new_revision integer)
language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_expected_revision < 0 then raise exception 'Invalid revision'; end if;
  if p_expected_revision = 0 then
    insert into public.user_workspaces(user_id, profile, campaigns)
      values(auth.uid(), p_profile, p_campaigns) on conflict (user_id) do nothing;
  end if;
  return query update public.user_workspaces
    set profile = p_profile, campaigns = p_campaigns,
        revision = revision + 1, updated_at = now()
    where user_id = auth.uid() and revision = p_expected_revision
    returning revision;
end;
$$;

revoke all on function public.save_marketpilot_workspace(jsonb,jsonb,integer) from public, anon;
grant execute on function public.save_marketpilot_workspace(jsonb,jsonb,integer) to authenticated;

commit;
