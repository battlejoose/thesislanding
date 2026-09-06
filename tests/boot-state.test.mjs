import test from 'node:test';
import assert from 'node:assert/strict';
import {idle,settle,finish,progress,caption,STAGES} from '../lib/boot-state.ts';

const all=state=>STAGES.reduce(settle,state);

test('the screen lifts only once every subsystem has reported',()=>{
  let state=idle;
  assert.equal(state.done,false);
  state=settle(state,'typography');assert.equal(state.done,false);
  state=settle(state,'world');assert.equal(state.done,false);
  state=settle(state,'gallery');assert.equal(state.done,true);
});
test('a subsystem reporting twice does not stand in for a silent one',()=>{
  let state=idle;
  for(let i=0;i<5;i++)state=settle(state,'world');
  assert.equal(state.settled.length,1);
  assert.equal(state.done,false);
});
test('progress and caption track the next outstanding subsystem',()=>{
  assert.equal(progress(idle),0);
  assert.equal(caption(idle),'Setting the type');
  const one=settle(idle,'typography');
  assert.ok(Math.abs(progress(one)-1/3)<1e-9);
  assert.equal(caption(one),'Raising the skyline');
  assert.equal(progress(all(idle)),1);
  assert.equal(caption(all(idle)),'Ready');
});
test('the watchdog lifts a stalled boot, and no WebGL lifts it at once',()=>{
  assert.equal(finish(idle).done,true);
  assert.equal(progress(finish(idle)),1);
  assert.equal(finish(settle(idle,'world')).done,true);
});
test('boot is one-way: a later failure cannot drop the screen back over the page',()=>{
  const done=all(idle);
  assert.equal(settle(done,'world').done,true);
  assert.equal(settle(done,'world'),done);
  assert.equal(finish(done),done);
});
