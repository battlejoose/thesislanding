import test from 'node:test';
import assert from 'node:assert/strict';
import {loreFor} from '../lib/lore.ts';
import {projects} from '../lib/projects.ts';

const dice=projects.find(p=>p.id==='dice');
const placeholder=projects.find(p=>p.comingSoon);

test('no build hovered means no dialogue box',()=>{
  assert.equal(loreFor(null,0),null);
  assert.equal(loreFor(undefined,3),null);
});
test('the finished build tells its story, unaffected by the seed',()=>{
  assert.equal(loreFor(dice,0).heading,'SATOSHI DICE / 2012');
  assert.deepEqual(loreFor(dice,0),loreFor(dice,57));
  assert.ok(loreFor(dice,0).lines.join(' ').includes('126,315 BTC'));
});
test('a placeholder teases, and every seed lands on a real line',()=>{
  const seen=new Set();
  for(let seed=0;seed<200;seed++){
    const lore=loreFor(placeholder,seed);
    assert.equal(lore.lines.length,1);
    assert.ok(placeholder.teases.includes(lore.lines[0]),`seed ${seed} produced "${lore.lines[0]}"`);
    seen.add(lore.lines[0]);
  }
  assert.equal(seen.size,placeholder.teases.length,'every tease should be reachable');
});
test('both placeholders tease and neither claims market figures',()=>{
  for(const p of projects.filter(p=>p.comingSoon)){
    assert.ok(loreFor(p,1));
    assert.equal(p.cap,'');
    assert.equal(p.change,'');
  }
});
