-- Preserve existing progress, events, dictionary and fixed groups.
begin;
alter table public.voca_events drop constraint if exists voca_events_kind_check;
alter table public.voca_events add constraint voca_events_kind_check check (kind in ('review','seen','favorite','settings','import','lesson'));

create or replace function public.voca_merge_lessons(current_items jsonb,incoming_items jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$
declare result jsonb:=coalesce(current_items,'{}'::jsonb); k text; item jsonb; prior jsonb;
begin
  if incoming_items is null then return result; end if;
  if jsonb_typeof(incoming_items)<>'object' then raise exception 'Invalid lessons'; end if;
  for k,item in select * from jsonb_each(incoming_items) loop
    if k !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      or item->>'id' is distinct from k or jsonb_typeof(item->'wordIds') is distinct from 'array'
      or length(item->>'title')>100 or item->>'title' is null or coalesce((item->>'updatedAt')::bigint,-1)<0
      or item->>'revision' is null or item->>'revision' !~ '^[0-9a-fA-F-]{36}$'
      or jsonb_typeof(item->'deleted') is distinct from 'boolean' then raise exception 'Invalid lesson'; end if;
    if jsonb_array_length(item->'wordIds')>1000 or exists(select 1 from jsonb_array_elements_text(item->'wordIds') w where w !~ '^[a-f0-9]{16}$') then raise exception 'Invalid lesson words'; end if;
    if length(coalesce(item->>'sourceUrl',''))>2048 or (coalesce(item->>'sourceUrl','')<>'' and item->>'sourceUrl' !~ '^https?://') then raise exception 'Invalid lesson URL'; end if;
    prior:=result->k;
    if prior is null or (item->>'updatedAt')::bigint>(prior->>'updatedAt')::bigint
      or ((item->>'updatedAt')::bigint=(prior->>'updatedAt')::bigint and (item->>'revision') collate "C">(prior->>'revision') collate "C") then result:=jsonb_set(result,array[k],item); end if;
  end loop;
  return result;
end $$;
revoke all on function public.voca_merge_lessons(jsonb,jsonb) from public,anon,authenticated;

-- One authenticated request per 100 queued actions. All actions in a batch commit
-- together; a retry uses the same IDs and never counts an answer twice.
create or replace function public.voca_sync_operations(ops jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); op jsonb; p jsonb; st jsonb; entry jsonb; lid text; at_ms bigint; eid uuid; activity_day text; ack jsonb:='[]'::jsonb;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if jsonb_typeof(ops) is distinct from 'array' then raise exception 'Invalid batch'; end if;
  if jsonb_array_length(ops)>100 or pg_column_size(ops)>8388608 then raise exception 'Batch too large'; end if;
  insert into public.voca_profiles(user_id) values(uid) on conflict do nothing;
  perform 1 from public.voca_profiles where user_id=uid for update;
  for op in select value from jsonb_array_elements(ops) loop
    eid:=(op->>'id')::uuid;
    if eid is null then raise exception 'Invalid operation ID'; end if;
    if not exists(select 1 from public.voca_events where user_id=uid and id=eid) then
      if op->>'kind'='lesson' then
        p:=op->'payload'; lid:=p->>'id'; at_ms:=(op->>'at')::bigint; activity_day:=op->>'day';
        if at_ms is null or at_ms<0 or activity_day is null or activity_day !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Invalid lesson operation'; end if;
        perform activity_day::date;
        entry:=p||jsonb_build_object('updatedAt',at_ms,'revision',eid::text);
        select state into st from public.voca_profiles where user_id=uid;
        st:=jsonb_set(st,'{lessons}',public.voca_merge_lessons(st->'lessons',jsonb_build_object(lid,entry)));
        if pg_column_size(st)>8388608 then raise exception 'Progress exceeds 8 MB'; end if;
        update public.voca_profiles set state=st,updated_at=clock_timestamp() where user_id=uid;
        insert into public.voca_events(user_id,id,kind,occurred_at,local_day,payload) values(uid,eid,'lesson',to_timestamp(at_ms/1000.0),activity_day::date,p);
      else
        perform public.voca_apply_operation(op);
        if op->>'kind'='import' and op->'payload'->'state' ? 'lessons' then
          select state into st from public.voca_profiles where user_id=uid;
          st:=jsonb_set(st,'{lessons}',public.voca_merge_lessons(st->'lessons',op->'payload'->'state'->'lessons'));
          if pg_column_size(st)>8388608 then raise exception 'Progress exceeds 8 MB'; end if;
          update public.voca_profiles set state=st where user_id=uid;
        end if;
      end if;
    end if;
    ack:=ack||jsonb_build_array(eid::text);
  end loop;
  select state into st from public.voca_profiles where user_id=uid;
  return jsonb_build_object('state',st,'acknowledged',ack);
end $$;
revoke all on function public.voca_sync_operations(jsonb) from public,anon;
grant execute on function public.voca_sync_operations(jsonb) to authenticated;
commit;
