import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { defaultState, validateState, groupsFor } from '../src/lib/learning.js';
import { operation, replay, mergeProgress, guestImport } from '../src/lib/operations.js';
import { favoriteWords, lessonCourse, lessonUrl, activeLessons, findSourceLessons } from '../src/lib/lessons.js';
import { syncQueued, needsExitWarning } from '../src/lib/sync.js';
const words=JSON.parse(await readFile(new URL('../src/data/vocabulary.json',import.meta.url)));
const sources=JSON.parse(await readFile(new URL('../src/data/lesson-catalog.json',import.meta.url)));
const ids=new Set(words.map(w=>w.id));
test('Favorite decks span courses, preserve added order, and practice all groups',()=>{
 const chosen=[words[200],words[1],words.at(-1)];let state=defaultState();
 chosen.forEach((w,i)=>state=replay(state,[{...operation('favorite',{wordId:w.id,value:true}),at:100+i}]));
 assert.deepEqual(favoriteWords(words,state).map(w=>w.id),chosen.map(w=>w.id));
 state=replay(state,[operation('favorite',{wordId:chosen[1].id,value:false})]);
 assert.deepEqual(favoriteWords(words,state).map(w=>w.id),[chosen[0].id,chosen[2].id]);
 const c=lessonCourse({id:randomUUID(),title:'Today',wordIds:words.slice(0,27).map(w=>w.id)},words);
 assert.deepEqual(groupsFor(c).map(g=>g.words.length),[20,7]);assert.deepEqual(c.words.map(w=>w.id),words.slice(0,27).map(w=>w.id));
});
test('Lessons survive local reload, backup/import, late edits, and reversible archive',()=>{
 const lesson={id:randomUUID(),title:'Reading unit 3',sourceUrl:'https://evstep.vn/example',wordIds:[words[0].id,words[10].id],deleted:false};
 const create=operation('lesson',lesson);const local=replay(defaultState(),[create]);
 assert.deepEqual(validateState(JSON.parse(JSON.stringify(local)),ids).lessons,local.lessons);
 assert.deepEqual(mergeProgress(defaultState(),local).lessons,local.lessons);
 const hide={...operation('lesson',{...lesson,deleted:true}),at:create.at+1};
 const hidden=replay(local,[hide,create]);assert.equal(activeLessons(hidden).length,0);
 assert.equal(activeLessons(replay(hidden,[{...operation('lesson',lesson),at:hide.at+1}])).length,1);
 assert.throws(()=>lessonUrl('javascript:alert(1)'));assert.equal(lessonUrl(''),'');
});
test('Guest baseline is imported before its queued reviews without losing later attempts',()=>{
 const wid=words[0].id;
 const base=replay(defaultState(),Array.from({length:5},()=>operation('review',{wordId:wid,result:'good',details:{}})));
 const queue=Array.from({length:2},()=>operation('review',{wordId:wid,result:'good',details:{}}));
 const first=guestImport({base,queue,importId:randomUUID()});
 const transferred=replay(defaultState(),[...queue,first].sort((a,b)=>a.at-b.at||a.id.localeCompare(b.id)));
 assert.equal(transferred.words[wid].reviews,7);
});
test('537 source glossaries retain valid source URLs and unique exact vocabulary IDs',()=>{
 assert.equal(sources.length,537);
 for(const l of sources){assert.equal(new URL(l.sourceUrl).searchParams.get('id'),l.id);assert.equal(new Set(l.wordIds).size,l.wordIds.length);assert.ok(l.wordIds.every(id=>ids.has(id)));}
 const l=sources.find(l=>l.id==='21492');assert.equal(l.wordIds.length,20);assert.ok(l.wordIds.includes(words[0].id));
 assert.deepEqual(findSourceLessons(sources,'https://evstep.vn/mod/thglossary/view.php?forceview=1&id=21492#test',new Map()),[l]);
});
test('Manual click uses batches and leaves actions created during the upload pending',async()=>{
 const queue=Array.from({length:205},()=>operation('seen',{wordId:words[0].id}));const calls=[],acks=[];
 const client={rpc:async(name,{ops})=>{calls.push({name,size:ops.length});if(calls.length===1)queue.push(operation('seen',{wordId:words[1].id}));return {data:{state:defaultState(),acknowledged:ops.map(op=>op.id)}};}};
 assert.equal(calls.length,0);
 await syncQueued({client,queue,onBatch:data=>acks.push(...data.acknowledged)});
 assert.deepEqual(calls.map(c=>c.size),[100,100,5]);assert.equal(acks.length,205);assert.equal(queue.filter(op=>!acks.includes(op.id)).length,1);
 assert.ok(calls.every(c=>c.name==='voca_sync_operations'));
});
test('Failed batch and account switch never acknowledge or discard unsent actions',async()=>{
 const queue=Array.from({length:101},()=>operation('seen',{wordId:words[0].id}));let count=0;const acks=[];
 await assert.rejects(()=>syncQueued({queue,client:{rpc:async(_, {ops})=>++count===2?{error:new Error('offline')}:{data:{state:defaultState(),acknowledged:ops.map(o=>o.id)}}},onBatch:d=>acks.push(...d.acknowledged)}),/offline/);
 assert.equal(acks.length,100);assert.equal(queue.filter(op=>!acks.includes(op.id)).length,1);
 let current=true;await syncQueued({queue:queue.slice(0,1),isCurrent:()=>current,client:{rpc:async()=>{current=false;return {data:{}};}},onBatch:()=>assert.fail('Must not update another account')});
 assert.equal(needsExitWarning('guest',1),false);assert.equal(needsExitWarning('alice',1),true);assert.equal(needsExitWarning('alice',0),false);assert.equal(needsExitWarning('guest',0,true),true);
});
test('Batched SQL keeps all history, atomicity, isolation, lesson imports and retry idempotency',async t=>{
 const db=await PGlite.create();t.after(()=>db.close());
 await db.exec(`create schema auth;create role anon;create role authenticated;grant usage on schema public,auth to authenticated,anon;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant execute on function auth.uid() to authenticated,anon;`);
 await db.exec(await readFile(new URL('../supabase/migrations/001_learning.sql',import.meta.url),'utf8'));
 const sql=await readFile(new URL('../supabase/migrations/004_manual_sync_lessons.sql',import.meta.url),'utf8');await db.exec(sql);await db.exec(sql);
 const alice=randomUUID(),bob=randomUUID(),lid=randomUUID();await db.query('insert into auth.users values($1),($2)',[alice,bob]);
 const login=async uid=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid]);await db.exec('set role authenticated');};
 const send=ops=>db.query('select public.voca_sync_operations($1::jsonb) as result',[JSON.stringify(ops)]);
 await login(alice);
 const ops=[operation('favorite',{wordId:words[0].id,value:true}),operation('review',{wordId:words[0].id,result:'good',details:{mode:'typing'}}),operation('lesson',{id:lid,title:'Lesson',sourceUrl:'https://evstep.vn/example',wordIds:[words[0].id],deleted:false})];
 const first=(await send(ops)).rows[0].result;assert.deepEqual(first.acknowledged,ops.map(op=>op.id));
 assert.deepEqual(validateState(first.state,ids),validateState(replay(defaultState(),ops),ids));
 assert.deepEqual((await send(ops)).rows[0].result,first);
 const bad=operation('lesson',{...ops[2].payload,sourceUrl:'javascript:alert(1)'}),newReview=operation('review',{wordId:words[0].id,result:'good',details:{}});
 await assert.rejects(()=>send([newReview,bad]),/Invalid lesson URL/);
 assert.equal((await db.query('select count(*)::int n from public.voca_events')).rows[0].n,3);
 const archived={...operation('lesson',{...ops[2].payload,deleted:true}),at:ops[2].at+1};await send([archived]);
 const imported=operation('import',{state:replay(defaultState(),[ops[2]])});await send([imported]);
 assert.equal((await send([])).rows[0].result.state.lessons[lid].deleted,true);
 await login(bob);assert.equal((await db.query('select * from public.voca_profiles')).rows.length,0);
 assert.deepEqual((await send([])).rows[0].result.state.words,{});
 await assert.rejects(()=>db.query('update public.voca_profiles set state=$1',[defaultState()]));
 await db.exec('reset role;set role anon');await assert.rejects(()=>send(ops));
});
