import test from 'node:test';
import assert from 'node:assert/strict';
import { groupsFor, groupProgress, defaultState, dayKey, recordReview } from '../src/lib/learning.js';
import { sessionReducer, sessionState } from '../src/lib/session.js';
import { applyOperation, mergeProgress } from '../src/lib/operations.js';
test('20-word groups partition the original order without omissions or overlap',()=>{
 const course={id:'course',words:Array.from({length:45},(_,i)=>({id:`w${i}`}))};const groups=groupsFor(course);
 assert.deepEqual(groups.map(g=>g.words.length),[20,20,5]);assert.deepEqual(groups.flatMap(g=>g.words),course.words);
 const progress={w0:{seenAt:1},w1:{level:1},w2:{level:5}};assert.deepEqual(groupProgress(groups[0],progress),{learned:2,remaining:18,complete:false});
 assert.deepEqual(groupsFor(course).map(g=>g.words.map(w=>w.id)),groups.map(g=>g.words.map(w=>w.id)));
});
test('Previous/next restores each card and never grades it; retry resets only the current attempt',()=>{
 let s=sessionState();s=sessionReducer(s,{type:'flip'});s=sessionReducer(s,{type:'hint'});s=sessionReducer(s,{type:'grade',correct:false,answer:'guess'});
 s=sessionReducer(s,{type:'go',index:1});assert.equal(s.cards[1],undefined);s=sessionReducer(s,{type:'go',index:0});assert.equal(s.cards[0].answer,'guess');assert.equal(s.cards[0].flipped,true);
 assert.strictEqual(sessionReducer(s,{type:'grade',correct:true,answer:'x'}),s);
 s=sessionReducer(s,{type:'retry'});assert.equal(s.cards[0].grade,null);assert.equal(s.cards[0].answer,'');assert.equal(s.cards[0].hinted,false);assert.equal(s.cards[0].attempt,1);assert.equal(s.cards[0].attempts.length,1);
 s=sessionReducer(s,{type:'grade',correct:true,answer:'correct'});assert.equal(s.cards[0].attempts.length,2);
});
test('Hints and immediate retries count as practice without increasing memory level',()=>{
 let s=recordReview(defaultState(),'a','good',100000);assert.equal(s.words.a.level,1);
 s=recordReview(s,'a','assisted',100001);assert.equal(s.words.a.level,1);assert.equal(s.activity[dayKey(100001)].correct,1);assert.equal(s.activity[dayKey(100001)].reviews,2);
});
test('Replay preserves the recorded local date when a device timezone differs',()=>{
 const op={id:'1',kind:'review',at:100000,day:'2026-11-04',payload:{wordId:'a',result:'good',details:{hinted:false}}};
 const state=applyOperation(defaultState(),op);assert.deepEqual(Object.keys(state.activity),['2026-11-04']);assert.equal(state.history[0].id,'1');
});
test('Import merges existing aggregate counts rather than adding the same backup twice',()=>{
 let a=recordReview(defaultState(),'a','good',100000);a.words.a.favorite=true;
 const first=mergeProgress(defaultState(),a);const twice=mergeProgress(first,a);assert.deepEqual(twice.activity,first.activity);assert.equal(twice.words.a.reviews,1);assert.equal(twice.words.a.favorite,true);
});
