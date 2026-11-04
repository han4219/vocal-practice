import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { extendManifest, hydrateCatalog, courseRoute, practiceRoute, practiceHash, lessonWords } from '../src/lib/catalog.js';
const words=JSON.parse(await readFile(new URL('../src/data/vocabulary.json',import.meta.url)));
const manifest=JSON.parse(await readFile(new URL('../src/data/course-groups.json',import.meta.url)));
const definitions=JSON.parse(await readFile(new URL('../src/data/course-definitions.json',import.meta.url)));
test('Bundled snapshot has fixed IDs and matches every ordered group',()=>{
 const hydrated=hydrateCatalog(words,manifest);
 assert.equal(hydrated.courses.length,15);assert.equal(hydrated.vocabulary.length,7671);
 assert.equal(hydrated.courses.reduce((n,c)=>n+c.groups.length,0),511);
 for(const c of hydrated.courses){assert.equal(new Set(c.words.map(w=>w.id)).size,c.words.length);for(const g of c.groups)assert.ok(g.words.length>0&&g.words.length<=20);}
 assert.ok(hydrated.vocabulary.every(w=>w.courses.length));
 assert.deepEqual(extendManifest(definitions,[...words].reverse(),manifest),manifest);
 assert.deepEqual(lessonWords(hydrated.courses[0].groups[0].words,{full:true,mode:'typing',goal:5}),hydrated.courses[0].groups[0].words);
});
test('Updating/reordering the source never fills, splits or moves existing groups',()=>{
 const c=[{id:'a',title:'A'}];const original=Array.from({length:21},(_,i)=>({id:`w${i}`,courses:['a']}));
 const before=extendManifest(c,original);const after=extendManifest(c,[{id:'new',courses:['a']},...original].reverse(),before);
 assert.deepEqual(after.courses[0].groups.slice(0,2),before.courses[0].groups);
 assert.deepEqual(after.courses[0].groups[2],{id:'a-3',number:3,wordIds:['new']});
 assert.throws(()=>extendManifest(c,original.slice(1),before),/must be retained/);
});
test('Course/group URLs and session order are independent of random state or progress',()=>{
 assert.deepEqual(courseRoute('#course/everyday/2'),{courseId:'everyday',number:2});
 assert.deepEqual(courseRoute('#course/everyday'),{courseId:'everyday',number:1});
 assert.equal(courseRoute('#practice'),null);
 const selection={deck:'B1.02',number:2,mode:'typing'};
 assert.deepEqual(practiceRoute(practiceHash(selection)),selection);
 assert.deepEqual(practiceRoute('#practice'),{deck:'everyday',number:1,mode:'mixed'});
 assert.equal(practiceRoute('#course/everyday/2'),null);
 assert.equal(courseRoute('#course/everyday/NaN').number,1);
 assert.deepEqual(lessonWords(words,{full:true,goal:5}),words);
 assert.deepEqual(lessonWords(words,{mode:'choice',goal:10}),words.slice(0,10));
});
test('Live-schema catalog roundtrip retains all words beyond API row limits, immutable groups, and read-only access',async t=>{
 const db=await PGlite.create();t.after(()=>db.close());
 await db.exec('create role anon;create role authenticated;grant usage on schema public to anon,authenticated;');
 const migration=await readFile(new URL('../supabase/migrations/002_fixed_catalog.sql',import.meta.url),'utf8');
 await db.exec(migration);await db.exec(migration);
 const payload={version:1,words,courses:manifest.courses};
 const install=p=>db.query('select public.voca_install_catalog($1::jsonb) as result',[JSON.stringify(p)]);
 const first=(await install(payload)).rows[0].result;
 assert.equal(first.words,7671);assert.equal(first.groups,511);assert.equal(first.courses,15);
 assert.deepEqual((await install(payload)).rows[0].result,first);
 const moved=structuredClone(payload);moved.courses[0].groups[0].wordIds.reverse();
 await assert.rejects(()=>install(moved),/membership cannot change/);
 await db.exec('set role anon');
 const read=()=>db.query('select public.voca_get_catalog() as catalog');
 const remote=(await read()).rows[0].catalog;
 assert.deepEqual(remote, payload);
 assert.equal(hydrateCatalog(remote.words,remote).courses.length,15);
 await assert.rejects(()=>install(payload));
 await assert.rejects(()=>db.query('delete from public.voca_group_words'));
 await db.exec('reset role;set role authenticated');
 assert.deepEqual((await read()).rows[0].catalog,remote);
 await assert.rejects(()=>db.query("update public.voca_vocabulary set entry='{}'::jsonb"));
});
