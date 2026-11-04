-- Public lesson content only. Does not change voca_profiles, voca_events or Auth.
begin;
create table if not exists public.voca_vocabulary (
  id text primary key check (id ~ '^[a-f0-9]{16}$'),
  entry jsonb not null check (entry->>'id'=id and entry ?& array['word','ipa','meaning','example']),
  sort_order integer not null unique check (sort_order>0)
);
create table if not exists public.voca_courses (
  id text primary key,
  metadata jsonb not null,
  sort_order integer not null unique check (sort_order>0)
);
create table if not exists public.voca_word_groups (
  id text primary key,
  course_id text not null references public.voca_courses(id),
  group_number integer not null check (group_number>0),
  unique(course_id,group_number), unique(id,course_id),
  check (id=course_id||'-'||group_number::text)
);
create table if not exists public.voca_group_words (
  group_id text not null,
  course_id text not null,
  position integer not null check (position between 1 and 20),
  word_id text not null references public.voca_vocabulary(id),
  primary key(group_id,position),
  unique(course_id,word_id),
  foreign key(group_id,course_id) references public.voca_word_groups(id,course_id)
);
-- These are the same public dictionary and lessons already shipped with the site.
alter table public.voca_vocabulary enable row level security;
alter table public.voca_courses enable row level security;
alter table public.voca_word_groups enable row level security;
alter table public.voca_group_words enable row level security;
do $$ declare t text; begin
  foreach t in array array['voca_vocabulary','voca_courses','voca_word_groups','voca_group_words'] loop
    if not exists(select 1 from pg_policies where schemaname='public' and tablename=t and policyname='public_catalog_read') then
      execute format('create policy public_catalog_read on public.%I for select to anon,authenticated using (true)',t);
    end if;
    execute format('revoke all on public.%I from anon,authenticated',t);
    execute format('grant select on public.%I to anon,authenticated',t);
  end loop;
end $$;

create or replace function public.voca_get_catalog() returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object('version',1,
    'words',coalesce((select jsonb_agg(v.entry order by v.sort_order) from public.voca_vocabulary v),'[]'::jsonb),
    'courses',coalesce((select jsonb_agg(c.metadata||jsonb_build_object('id',c.id,'groups',
      (select coalesce(jsonb_agg(jsonb_build_object('id',g.id,'number',g.group_number,'wordIds',
        (select coalesce(jsonb_agg(w.word_id order by w.position),'[]'::jsonb) from public.voca_group_words w where w.group_id=g.id)
      ) order by g.group_number),'[]'::jsonb) from public.voca_word_groups g where g.course_id=c.id)
    ) order by c.sort_order) from public.voca_courses c),'[]'::jsonb));
$$;
revoke all on function public.voca_get_catalog() from public;
grant execute on function public.voca_get_catalog() to anon,authenticated;

-- Administrative import only: immutable membership + append-only new groups.
-- Re-running the same seed updates wording but never moves an assigned word.
create or replace function public.voca_install_catalog(payload jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare c jsonb; g jsonb; w jsonb; item jsonb; cid text; gid text; existing text[]; incoming text[]; n integer; pos integer; word_base integer; course_base integer;
begin
  if payload->>'version' is distinct from '1' or jsonb_typeof(payload->'words') is distinct from 'array' or jsonb_typeof(payload->'courses') is distinct from 'array' then raise exception 'Invalid catalog'; end if;
  -- Serialize simultaneous administrative imports, not learning operations.
  lock table public.voca_courses in share row exclusive mode;
  select coalesce(max(sort_order),0) into word_base from public.voca_vocabulary;
  for w in select value from jsonb_array_elements(payload->'words') loop
    if exists(select 1 from public.voca_vocabulary where id=w->>'id') then
      update public.voca_vocabulary set entry=w where id=w->>'id';
    else
      word_base:=word_base+1;
      insert into public.voca_vocabulary(id,entry,sort_order) values(w->>'id',w,word_base);
    end if;
  end loop;
  select coalesce(max(sort_order),0) into course_base from public.voca_courses;
  for c in select value from jsonb_array_elements(payload->'courses') loop
    cid:=c->>'id';
    if exists(select 1 from public.voca_courses where id=cid) then
      update public.voca_courses set metadata=c-array['groups','id'] where id=cid;
    else
      course_base:=course_base+1;
      insert into public.voca_courses(id,metadata,sort_order) values(cid,c-array['groups','id'],course_base);
    end if;
    if exists(select 1 from public.voca_word_groups old where old.course_id=cid and not exists(select 1 from jsonb_array_elements(c->'groups') x where x->>'id'=old.id)) then raise exception 'Existing groups cannot be removed: %',cid; end if;
    for g in select value from jsonb_array_elements(c->'groups') loop
      gid:=g->>'id'; n:=(g->>'number')::integer;
      if jsonb_typeof(g->'wordIds') is distinct from 'array' or jsonb_array_length(g->'wordIds') not between 1 and 20 then raise exception 'Invalid group size: %',gid; end if;
      select array_agg(value order by ord) into incoming from jsonb_array_elements_text(g->'wordIds') with ordinality as x(value,ord);
      if exists(select 1 from public.voca_word_groups where id=gid) then
        select array_agg(word_id order by position) into existing from public.voca_group_words where group_id=gid;
        if existing is distinct from incoming then raise exception 'Fixed group membership cannot change: %',gid; end if;
      else
        if n<>(select coalesce(max(group_number),0)+1 from public.voca_word_groups where course_id=cid) then raise exception 'Groups must be appended in order: %',gid; end if;
        insert into public.voca_word_groups(id,course_id,group_number) values(gid,cid,n);
        for item,pos in select to_jsonb(value),ord::integer from jsonb_array_elements_text(g->'wordIds') with ordinality as x(value,ord) loop
          insert into public.voca_group_words(group_id,course_id,position,word_id) values(gid,cid,pos,item#>>'{}');
        end loop;
      end if;
    end loop;
  end loop;
  return jsonb_build_object('words',(select count(*) from public.voca_vocabulary),'courses',(select count(*) from public.voca_courses),'groups',(select count(*) from public.voca_word_groups),'memberships',(select count(*) from public.voca_group_words));
end $$;
revoke all on function public.voca_install_catalog(jsonb) from public,anon,authenticated;
commit;
