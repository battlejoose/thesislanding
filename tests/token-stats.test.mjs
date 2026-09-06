import test from 'node:test';
import assert from 'node:assert/strict';
import {formatCap,formatChange,fetchTokenStats} from '../lib/token-stats.ts';

test('market caps read at a glance across magnitudes',()=>{
  assert.equal(formatCap(267988),'$268K');
  assert.equal(formatCap(1_250_000),'$1.25M');
  assert.equal(formatCap(3_400_000_000),'$3.40B');
  assert.equal(formatCap(842),'$842');
});
test('a missing or nonsensical cap shows a dash, never a zero',()=>{
  for(const value of [0,-5,NaN,Infinity])assert.equal(formatCap(value),'—');
});
test('change keeps its sign so a fall is never shown as a rise',()=>{
  assert.equal(formatChange(8.241),'+8.24%');
  assert.equal(formatChange(-19.9),'−19.90%');
  assert.equal(formatChange(0),'+0.00%');
  assert.equal(formatChange(NaN),'—');
});
test('the deepest pool wins when a token trades in several',async()=>{
  const body={pairs:[
    {liquidity:{usd:100},marketCap:1_000_000,priceChange:{h24:5}},
    {liquidity:{usd:90_000},marketCap:2_000_000,priceChange:{h24:-3}},
    {liquidity:{usd:500},marketCap:9_000_000,priceChange:{h24:99}},
  ]};
  global.fetch=async()=>({ok:true,json:async()=>body});
  assert.deepEqual(await fetchTokenStats('0xabc'),{cap:'$2.00M',change:'−3.00%',up:false});
});
test('a failed, empty or rejected response yields null rather than a fake number',async()=>{
  global.fetch=async()=>({ok:false,json:async()=>({})});
  assert.equal(await fetchTokenStats('0xabc'),null);
  global.fetch=async()=>({ok:true,json:async()=>({pairs:[]})});
  assert.equal(await fetchTokenStats('0xabc'),null);
  global.fetch=async()=>{throw new Error('offline');};
  assert.equal(await fetchTokenStats('0xabc'),null);
});
