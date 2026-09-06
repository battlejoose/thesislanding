import test from 'node:test';
import assert from 'node:assert/strict';
import {formatCap,formatChange,pickPair,toStats,fetchTokenStats} from '../lib/token-stats.ts';

test('market caps read at a glance across magnitudes',()=>{
  assert.equal(formatCap(291397),'$291K');
  assert.equal(formatCap(1_250_000),'$1.25M');
  assert.equal(formatCap(3_400_000_000),'$3.40B');
  assert.equal(formatCap(43520.43),'$43.5K');
  assert.equal(formatCap(6749.74),'$6.7K');
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
test('a graduated pool outranks the stale bonding-curve pair left behind',()=>{
  // Shape taken from ZCASHCAT, which lists both at once.
  const graduated={dexId:'pumpswap',liquidity:{usd:49701.29},marketCap:291397,priceChange:{h24:180}};
  const curve={dexId:'pumpfun',liquidity:null,marketCap:43520.43,priceChange:{h24:1360}};
  assert.equal(pickPair([curve,graduated]),graduated);
  assert.equal(pickPair([graduated,curve]),graduated);
  assert.deepEqual(toStats(pickPair([curve,graduated])),{cap:'$291K',change:'+180.00%',up:true});
});
test('a token still on its bonding curve reports no liquidity and still resolves',()=>{
  const curve={dexId:'pumpfun',liquidity:null,marketCap:6749.74,priceChange:{h24:127}};
  assert.deepEqual(toStats(pickPair([curve])),{cap:'$6.7K',change:'+127.00%',up:true});
});
test('falls back to the per-chain endpoint when the token search knows nothing',async()=>{
  const calls=[];
  global.fetch=async url=>{
    calls.push(String(url));
    if(String(url).includes('/latest/dex/tokens/'))return{ok:true,json:async()=>({pairs:[]})};
    return{ok:true,json:async()=>[{liquidity:null,marketCap:6749.74,priceChange:{h24:127}}]};
  };
  assert.deepEqual(await fetchTokenStats('MINT'),{cap:'$6.7K',change:'+127.00%',up:true});
  assert.equal(calls.length,2);
  assert.ok(calls[1].includes('/token-pairs/v1/solana/MINT'));
});
test('a failed, empty or rejected response yields null rather than a fake number',async()=>{
  global.fetch=async()=>({ok:false,json:async()=>({})});
  assert.equal(await fetchTokenStats('MINT'),null);
  global.fetch=async()=>({ok:true,json:async()=>({pairs:[]})});
  assert.equal(await fetchTokenStats('MINT'),null);
  global.fetch=async()=>{throw new Error('offline');};
  assert.equal(await fetchTokenStats('MINT'),null);
});
