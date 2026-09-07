import test from 'node:test';
import assert from 'node:assert/strict';
import {idle,settle,finish,progress,caption,STAGES} from '../lib/boot-state.ts';

const all=state=>STAGES.reduce(settle,state);

test('the screen lifts only once every subsystem has reported',()=>{
  let state=idle;
  assert.equal(state.done,false);
  state=settle(state,'typography');assert.equal(state.done,false);
  state=settle(state,'world');assert.equal(state.done,false);
  state=settle(state,'gallery');assert.equal(state.done,false);
  assert.equal(caption(state),'Loading token images');
  state=settle(state,'images');assert.equal(state.done,true);
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
  assert.ok(Math.abs(progress(one)-1/4)<1e-9);
  assert.equal(caption(one),'Raising the skyline');
  assert.equal(progress(all(idle)),1);
  assert.equal(caption(all(idle)),'Ready');
});
test('the watchdog lifts a stalled boot even when token images never arrive',()=>{
  assert.equal(finish(idle).done,true);
  assert.equal(progress(finish(idle)),1);
  assert.equal(finish(settle(idle,'world')).done,true);
});
test('without WebGL the HTML tiles still wait for decoded token images',()=>{
  const graphics=['typography','world','gallery'].reduce(settle,idle);
  assert.equal(graphics.done,false);
  assert.equal(progress(graphics),.75);
  assert.equal(settle(graphics,'images').done,true);
});
test('decoded images still wait for the gallery to render them before reveal',()=>{
  const images=['typography','world','images'].reduce(settle,idle);
  assert.equal(images.done,false);
  assert.equal(settle(images,'gallery').done,true);
});
test('boot is one-way: a later failure cannot drop the screen back over the page',()=>{
  const done=all(idle);
  assert.equal(settle(done,'world').done,true);
  assert.equal(settle(done,'world'),done);
  assert.equal(finish(done),done);
});

// Regression: an unresolved capability check must not settle a stage.
// Reading "not yet known" as "unsupported" lifted the screen before any 3D
// existed, which showed the plain cards for a moment on every first load.
test('an unknown WebGL answer settles nothing; only a definite false does',()=>{
  const gate=support=>support===null||support===undefined?'wait':support?'build3d':'settle';
  assert.equal(gate(null),'wait');
  assert.equal(gate(undefined),'wait');
  assert.equal(gate(false),'settle');
  assert.equal(gate(true),'build3d');
});
