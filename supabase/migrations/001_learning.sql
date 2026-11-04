-- Run once in Supabase SQL Editor. Existing data is preserved on re-run.
begin;
create table if not exists public.voca_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{"version":1,"words":{},"activity":{},"settings":{"goal":10,"accent":"en-US","rate":0.9},"history":[]}'::jsonb,
  updated_at timestamptz not null default now()
);
create table if not exists public.voca_events (
  user_id uuid not null references auth.users(id) on delete cascade,
  id uuid not null,
  kind text not null check (kind in ('review','seen','favorite','settings','import')),
  occurred_at timestamptz not null,
  local_day date not null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  primary key(user_id,id)
);
create index if not exists voca_events_history on public.voca_events(user_id,occurred_at desc);
alter table public.voca_profiles enable row level security;
alter table public.voca_events enable row level security;
drop policy if exists owner_read on public.voca_profiles;
create policy owner_read on public.voca_profiles for select to authenticated using ((select auth.uid())=user_id);
drop policy if exists owner_read on public.voca_events;
create policy owner_read on public.voca_events for select to authenticated using ((select auth.uid())=user_id);
revoke all on public.voca_profiles,public.voca_events from anon,authenticated;
grant select on public.voca_profiles,public.voca_events to authenticated;

-- Only this transaction may write. UID always comes from the authenticated JWT.
-- UUID idempotency prevents a network retry from counting the same answer twice.
create or replace function public.voca_apply_operation(op jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  eid uuid; kind text; p jsonb; st jsonb; w jsonb; a jsonb; h jsonb;
  wid text; at_ms bigint; activity_day text; lvl int; correct_delta int; review_time bigint;
  k text; item jsonb; prior jsonb; merged jsonb; incoming jsonb; favorite_item jsonb; empty_before boolean;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if pg_column_size(op)>8388608 then raise exception 'Operation too large'; end if;
  eid := (op->>'id')::uuid; kind:=op->>'kind'; p:=op->'payload';
  at_ms:=(op->>'at')::bigint; activity_day:=op->>'day';
  if eid is null or kind is null or p is null or jsonb_typeof(p)<>'object' or at_ms is null or at_ms<0 or activity_day is null or activity_day !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Invalid operation'; end if;
  perform activity_day::date;
  insert into public.voca_profiles(user_id) values(uid) on conflict do nothing;
  select state into st from public.voca_profiles where user_id=uid for update;
  if exists(select 1 from public.voca_events where user_id=uid and id=eid) then return; end if;
  empty_before:=st->'words'='{}'::jsonb;
  wid:=p->>'wordId';
  if kind in ('review','seen','favorite') and (wid is null or wid !~ '^[a-f0-9]{16}$') then raise exception 'Invalid word ID'; end if;
  w:=coalesce(st->'words'->wid,'{}'::jsonb);
  if kind='review' then
    if p->>'result' is null or p->>'result' not in ('good','again','mastered','assisted') then raise exception 'Invalid result'; end if;
    lvl:=coalesce((w->>'level')::int,0);
    lvl:=case p->>'result' when 'mastered' then 5 when 'again' then 1 when 'assisted' then greatest(1,lvl) else least(5,lvl+1) end;
    review_time:=greatest(at_ms,coalesce((w->>'lastReview')::bigint,0));
    w:=w||jsonb_build_object('level',lvl,'reviews',coalesce((w->>'reviews')::int,0)+1,'lastReview',review_time,'nextReview',review_time+(array[0::bigint,600000,86400000,259200000,604800000,1814400000])[lvl+1]);
    st:=jsonb_set(st,array['words',wid],w);
    a:=coalesce(st->'activity'->activity_day,'{"ids":[],"reviews":0,"correct":0}'::jsonb);
    correct_delta:=case when p->>'result' in ('again','assisted') then 0 else 1 end;
    a:=a||jsonb_build_object('ids',case when (a->'ids') ? wid then a->'ids' else (a->'ids')||jsonb_build_array(wid) end,'reviews',(a->>'reviews')::int+1,'correct',(a->>'correct')::int+correct_delta);
    st:=jsonb_set(st,array['activity',activity_day],a);
    h:=coalesce(st->'history','[]'::jsonb)||jsonb_build_array(jsonb_build_object('id',eid,'wordId',wid,'at',at_ms,'result',p->>'result')||coalesce(p->'details','{}'::jsonb));
    select coalesce(jsonb_agg(value order by ord),'[]') into h from jsonb_array_elements(h) with ordinality as e(value,ord) where ord>jsonb_array_length(h)-100;
    st:=jsonb_set(st,'{history}',h);
  elsif kind='seen' then
    st:=jsonb_set(st,array['words',wid],w||jsonb_build_object('seenAt',greatest(at_ms,coalesce((w->>'seenAt')::bigint,0))));
  elsif kind='favorite' then
    if jsonb_typeof(p->'value') is distinct from 'boolean' then raise exception 'Invalid favorite'; end if;
    st:=jsonb_set(st,array['words',wid],w||jsonb_build_object('favorite',p->'value','favoriteAt',at_ms));
  elsif kind='settings' then
    if (p ? 'goal' and p->>'goal' not in ('5','10','15','20')) or (p ? 'accent' and p->>'accent' not in ('en-US','en-GB')) or (p ? 'rate' and p->>'rate' not in ('0.7','0.9','1')) or p- array['goal','accent','rate']<>'{}'::jsonb then raise exception 'Invalid settings'; end if;
    st:=jsonb_set(st,'{settings}',(st->'settings')||p)||jsonb_build_object('settingsAt',at_ms);
  elsif kind='import' then
    incoming:=p->'state';
    if incoming->>'version' is distinct from '1' or jsonb_typeof(incoming->'words') is distinct from 'object' or jsonb_typeof(incoming->'activity') is distinct from 'object' or jsonb_typeof(incoming->'settings') is distinct from 'object' then raise exception 'Invalid backup'; end if;
    for k,item in select * from jsonb_each(incoming->'words') loop
      if k !~ '^[a-f0-9]{16}$' or coalesce((item->>'level')::int,0) not between 0 and 5 then raise exception 'Invalid imported word'; end if;
      prior:=coalesce(st->'words'->k,'{}'::jsonb);
      merged:=case when coalesce((item->>'lastReview')::bigint,0)>coalesce((prior->>'lastReview')::bigint,0) then prior||item else prior end;
      favorite_item:=case when coalesce((item->>'favoriteAt')::bigint,0)>coalesce((prior->>'favoriteAt')::bigint,0) or prior='{}'::jsonb then item else prior end;
      merged:=merged||jsonb_build_object('reviews',greatest(coalesce((item->>'reviews')::int,0),coalesce((prior->>'reviews')::int,0)),'seenAt',greatest(coalesce((item->>'seenAt')::bigint,0),coalesce((prior->>'seenAt')::bigint,0)),'favorite',coalesce((favorite_item->>'favorite')::boolean,false),'favoriteAt',coalesce((favorite_item->>'favoriteAt')::bigint,0));
      st:=jsonb_set(st,array['words',k],merged);
    end loop;
    for k,item in select * from jsonb_each(incoming->'activity') loop
      perform k::date;
      prior:=coalesce(st->'activity'->k,'{"ids":[],"reviews":0,"correct":0}'::jsonb);
      select coalesce(jsonb_agg(value),'[]') into h from (select distinct value from jsonb_array_elements((prior->'ids')||(item->'ids'))) x;
      st:=jsonb_set(st,array['activity',k],jsonb_build_object('ids',h,'reviews',greatest((prior->>'reviews')::int,(item->>'reviews')::int),'correct',greatest((prior->>'correct')::int,(item->>'correct')::int)));
    end loop;
    if coalesce((incoming->>'settingsAt')::bigint,0)>coalesce((st->>'settingsAt')::bigint,0) or empty_before then st:=jsonb_set(st,'{settings}',incoming->'settings')||jsonb_build_object('settingsAt',coalesce((incoming->>'settingsAt')::bigint,0)); end if;
    -- Pre-upgrade backups contain aggregates, not individual historical answers.
    -- Keep history in the append-only event table; never invent missing attempts.
  else raise exception 'Invalid operation kind'; end if;
  if pg_column_size(st)>8388608 then raise exception 'Progress exceeds 8 MB'; end if;
  insert into public.voca_events(user_id,id,kind,occurred_at,local_day,payload) values(uid,eid,kind,to_timestamp(at_ms/1000.0),activity_day::date,p);
  update public.voca_profiles set state=st,updated_at=clock_timestamp() where user_id=uid;
end $$;
revoke all on function public.voca_apply_operation(jsonb) from public,anon;
grant execute on function public.voca_apply_operation(jsonb) to authenticated;
-- Optional live refresh; polling/focus refresh still works without Realtime.
do $$ begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='voca_profiles') then
    alter publication supabase_realtime add table public.voca_profiles;
  end if;
end $$;
commit;
