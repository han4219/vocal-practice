import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { defaultState, recordReview, isDue, INTERVALS, dayKey, streak, questionFor, validateState, normalizeAnswer } from '../src/lib/learning.js';
const vocabulary = JSON.parse(await readFile(new URL('../src/data/vocabulary.json',import.meta.url)));
const additions = JSON.parse(await readFile(new URL('../src/data/additions.json',import.meta.url)));
const now = new Date(2026, 10, 4, 12).getTime();
test('All source senses have unique stable IDs, complete fields, and valid course links',()=>{
 assert.equal(vocabulary.filter(w=>w.source==='sheet').length,7646);
 assert.equal(vocabulary.filter(w=>w.source==='editorial').length,25);
 assert.equal(new Set(vocabulary.map(w=>w.id)).size,vocabulary.length);
 const source=new Set(vocabulary.filter(w=>w.source==='sheet').map(w=>w.word.toLowerCase()));
 for(const w of vocabulary){for(const field of ['id','word','ipa','meaning','example'])assert.ok(w[field]?.trim(),`${w.word}: ${field}`);assert.ok(w.courses.length);if(w.source==='editorial')assert.ok(!source.has(w.word.toLowerCase()));}
 assert.equal(additions.length,25);
});
test('Review schedule advances, caps at mastery, and resets failures',()=>{
 let state=defaultState();
 assert.equal(isDue(state.words.a,now),false);
 for(let level=1;level<=5;level++){
 state=recordReview(state,'a','good',now);assert.equal(state.words.a.level,level);
 assert.equal(state.words.a.nextReview,now+INTERVALS[level]);
 assert.equal(isDue(state.words.a,now+INTERVALS[level]-1),false);assert.equal(isDue(state.words.a,now+INTERVALS[level]),true);
 }
 state=recordReview(state,'a','good',now);assert.equal(state.words.a.level,5);
 state=recordReview(state,'a','again',now);assert.equal(state.words.a.level,1);
 assert.equal(state.activity[dayKey(now)].ids.length,1);assert.equal(state.activity[dayKey(now)].reviews,7);assert.equal(state.activity[dayKey(now)].correct,6);
});
test('Streak permits yesterday and uses calendar days',()=>{
 let state=defaultState();
 for(let i=1;i<=3;i++){const d=new Date(now);d.setDate(d.getDate()-i);state=recordReview(state,'a','good',d.getTime());}
 assert.equal(streak(state.activity,now),3);state=recordReview(state,'b','good',now);assert.equal(streak(state.activity,now),4);
 const later=new Date(now);later.setDate(later.getDate()+2);assert.equal(streak(state.activity,later.getTime()),0);
});
test('Multiple choice excludes same-spelling senses and duplicate meanings',()=>{
 const word={id:'a',word:'bank',meaning:'ngân hàng',example:'I work at a bank.'};
 const pool=[word,{id:'b',word:'bank',meaning:'bờ sông'},{id:'c',word:'car',meaning:'xe hơi'},{id:'d',word:'auto',meaning:'xe hơi'},{id:'e',word:'tree',meaning:'cây'},{id:'f',word:'cat',meaning:'mèo'}];
 const q=questionFor(word,pool);assert.equal(q.options.length,4);assert.equal(new Set(q.options).size,4);assert.ok(!q.options.includes('bờ sông'));assert.ok(q.options.includes(word.meaning));
});
test('Cloze handles regex characters and falls back for inflected source examples',()=>{
 const w={word:'C++',example:'I study C++ every day.'};assert.equal(questionFor(w,[],'typing').prompt,'I study ________ every day.');
 assert.equal(questionFor({word:'abandon',example:'We abandoned the plan.'},[],'typing').cloze,false);
 const q=questionFor({word:'(get) stuck',example:'We got stuck in traffic.'},[],'typing');assert.equal(q.cloze,false);
 assert.equal(normalizeAnswer('  Don’t   worry! '),"don't worry");
});
test('Backup validates IDs, levels, preferences and clamps invalid statistics',()=>{
 const raw=defaultState();raw.words={a:{level:3,favorite:true,nextReview:now},unknown:{level:1}};raw.settings.goal=999;raw.activity[dayKey(now)]={ids:['a','a','unknown'],reviews:2,correct:999};
 const clean=validateState(raw,new Set(['a']));assert.equal(clean.settings.goal,10);assert.deepEqual(Object.keys(clean.words),['a']);assert.deepEqual(clean.activity[dayKey(now)].ids,['a']);assert.equal(clean.activity[dayKey(now)].correct,2);
 assert.throws(()=>validateState({version:42},new Set()));
 raw.words.a.level=9;assert.throws(()=>validateState(raw,new Set(['a'])));
});
