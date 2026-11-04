import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { defaultState, validateState } from '../src/lib/learning.js';
import { applyOperation } from '../src/lib/operations.js';
test('PostgreSQL migration, owner isolation, idempotency, history and offline replay',async t=>{
 const db=await PGlite.create();t.after(()=>db.close());
 await db.exec(`create schema auth;create role anon;create role authenticated;grant usage on schema public,auth to authenticated,anon;
 create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant execute on function auth.uid() to authenticated,anon;`);
 const sql=await readFile(new URL('../supabase/migrations/001_learning.sql',import.meta.url),'utf8');await db.exec(sql);await db.exec(sql);
 const alice=randomUUID(),bob=randomUUID(),wid='aabbccddeeff0011';
 await db.query('insert into auth.users values($1),($2)',[alice,bob]);
 const login=async uid=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid]);await db.exec('set role authenticated');};
 const get=async()=>((await db.query('select state from public.voca_profiles')).rows[0]?.state||defaultState());
 const send=op=>db.query('select public.voca_apply_operation($1::jsonb)',[JSON.stringify(op)]);
 await login(alice);let local=defaultState();
 const ops=[
  {kind:'seen',payload:{wordId:wid}},
  {kind:'review',payload:{wordId:wid,result:'again',details:{answer:'guess',mode:'typing',correct:false}}},
  {kind:'review',payload:{wordId:wid,result:'assisted',details:{answer:'make the bed',mode:'typing',hinted:true,retry:true,correct:true}}},
  {kind:'favorite',payload:{wordId:wid,value:true}},
  {kind:'settings',payload:{goal:20,accent:'en-GB',rate:0.7}},
  {kind:'review',payload:{wordId:wid,result:'good',details:{mode:'flashcard',correct:true}}},
 ].map((op,i)=>({...op,id:randomUUID(),at:1793764800000+i*1000,day:'2026-11-04'}));
 for(const op of ops){await send(op);local=applyOperation(local,op);await send(op);}
 const actual=validateState(await get(),new Set([wid]));const expected=validateState(local,new Set([wid]));assert.deepEqual(actual,expected);
 assert.equal((await db.query('select count(*)::int n from public.voca_events')).rows[0].n,ops.length);
 assert.equal(actual.words[wid].level,2);assert.equal(actual.activity['2026-11-04'].reviews,3);
 await assert.rejects(()=>db.query('update public.voca_profiles set state=$1',[defaultState()]));
 await assert.rejects(()=>db.query('delete from public.voca_events'));
 await login(bob);assert.equal((await db.query('select * from public.voca_profiles')).rows.length,0);assert.equal((await db.query('select * from public.voca_events')).rows.length,0);
 await send({...ops[0],id:randomUUID()});assert.equal((await get()).words[wid].seenAt,ops[0].at);
 await login(alice);assert.equal((await get()).words[wid].level,2);
 const backup={...defaultState(),settings:{goal:15,accent:'en-US',rate:1},words:{[wid]:{level:3,lastReview:1793764900000,nextReview:1793765000000,reviews:5,seenAt:1,favorite:false}},activity:{'2026-11-04':{ids:[wid],reviews:5,correct:3}}};
 const imp={kind:'import',id:randomUUID(),at:1793765000000,day:'2026-11-04',payload:{state:backup}};
 await send(imp);await send({...imp,id:randomUUID()});assert.equal((await get()).activity['2026-11-04'].reviews,5);assert.equal((await get()).words[wid].level,3);assert.equal((await get()).words[wid].favorite,true);
 await assert.rejects(()=>send({...ops[1],id:randomUUID(),payload:{wordId:wid,result:'invented'}}));
 const count=(await db.query('select count(*)::int n from public.voca_events')).rows[0].n;assert.equal(count,8);
 // More than the UI cache limit must still retain every database attempt.
 for(let i=0;i<105;i++)await send({...ops[2],id:randomUUID(),at:1793766000000+i});
 assert.equal((await db.query("select count(*)::int n from public.voca_events where kind='review'")).rows[0].n,108);
 assert.equal((await get()).history.length,100);
 await db.exec('reset role;set role anon');await assert.rejects(()=>db.query('select * from public.voca_profiles'));await assert.rejects(()=>send(ops[0]));
});
