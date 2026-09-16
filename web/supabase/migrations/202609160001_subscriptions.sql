create table if not exists public.marketpilot_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free','basic','plus','premium')),
  status text not null default 'active' check (status in ('active','past_due','cancelled')),
  provider_customer_id text,
  provider_subscription_id text,
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);
create table if not exists public.marketpilot_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  metric text not null check (metric in ('posts','graphics')),
  period_start date not null,
  quantity integer not null default 0 check (quantity >= 0),
  primary key(user_id,metric,period_start)
);
alter table public.marketpilot_subscriptions enable row level security;
alter table public.marketpilot_usage enable row level security;
create policy "read own subscription" on public.marketpilot_subscriptions for select using (auth.uid()=user_id);
create policy "read own usage" on public.marketpilot_usage for select using (auth.uid()=user_id);
insert into public.marketpilot_subscriptions(user_id,plan,status) select id,'free','active' from auth.users on conflict(user_id) do nothing;
create or replace function public.create_marketpilot_subscription() returns trigger language plpgsql security definer set search_path=public as $$ begin insert into public.marketpilot_subscriptions(user_id) values(new.id) on conflict do nothing; return new; end $$;
drop trigger if exists create_marketpilot_subscription on auth.users;
create trigger create_marketpilot_subscription after insert on auth.users for each row execute function public.create_marketpilot_subscription();
create or replace function public.consume_marketpilot_usage(p_metric text,p_amount integer) returns boolean language plpgsql security definer set search_path=public as $$
declare v_plan text;v_limit integer;v_start date;v_current integer;
begin
 if p_metric not in ('posts','graphics') or p_amount<1 then return false;end if;
 select plan into v_plan from marketpilot_subscriptions where user_id=auth.uid() and status='active';v_plan:=coalesce(v_plan,'free');
 v_limit:=case p_metric when 'posts' then case v_plan when 'free' then 14 when 'basic' then 50 when 'plus' then 150 else 500 end else case v_plan when 'free' then 2 when 'basic' then 10 when 'plus' then 50 else 200 end end;
 v_start:=(current_date-(extract(isodow from current_date)::integer-1));
 insert into marketpilot_usage(user_id,metric,period_start,quantity) values(auth.uid(),p_metric,v_start,p_amount)
 on conflict(user_id,metric,period_start) do update set quantity=marketpilot_usage.quantity+excluded.quantity
 where marketpilot_usage.quantity+excluded.quantity<=v_limit returning quantity into v_current;
 return v_current is not null and v_current<=v_limit;
end $$;
revoke all on function public.consume_marketpilot_usage(text,integer) from public;
grant execute on function public.consume_marketpilot_usage(text,integer) to authenticated;
