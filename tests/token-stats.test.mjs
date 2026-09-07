import test from 'node:test';
import assert from 'node:assert/strict';
import {formatCap,formatChange,pickPair,toStats,fetchTokenStats,shortAddress,pumpFunUrl,safeLink,dollars} from '../lib/token-stats.ts';

const figures=s=>s&&{cap:s.cap,change:s.change,up:s.up};

test('market caps read at a glance across magnitudes',()=>{
  assert.equal(formatCap(291397),'$291K');
  assert.equal(formatCap(1_250_000),'$1.25M');
  assert.equal(formatCap(3_400_000_000),'$3.40B');
  assert.equal(formatCap(43520.43),'$43.5K');
  assert.equal(formatCap(6749.74),'$6.7K');
  assert.equal(formatCap(842),'$842');
});
test('a missing or nonsensical cap shows a dash, never a zero',()=>{
  for(const value of [0,-5,NaN,Infinity])assert.equal(formatCap(value),'N/A');
});
test('change keeps its sign so a fall is never shown as a rise',()=>{
  assert.equal(formatChange(8.241),'+8.24%');
  assert.equal(formatChange(-19.9),'-19.90%');
  assert.equal(formatChange(0),'+0.00%');
  assert.equal(formatChange(NaN),'N/A');
});
test('a graduated pool outranks the stale bonding-curve pair left behind',()=>{
  // Shape taken from ZCASHCAT, which lists both at once.
  const graduated={dexId:'pumpswap',liquidity:{usd:49701.29},marketCap:291397,priceChange:{h24:180}};
  const curve={dexId:'pumpfun',liquidity:null,marketCap:43520.43,priceChange:{h24:1360}};
  assert.equal(pickPair([curve,graduated]),graduated);
  assert.equal(pickPair([graduated,curve]),graduated);
  assert.deepEqual(figures(toStats(pickPair([curve,graduated]))),{cap:'$291K',change:'+180.00%',up:true});
});
test('a token still on its bonding curve reports no liquidity and still resolves',()=>{
  const curve={dexId:'pumpfun',liquidity:null,marketCap:6749.74,priceChange:{h24:127}};
  assert.deepEqual(figures(toStats(pickPair([curve]))),{cap:'$6.7K',change:'+127.00%',up:true});
});
test('falls back to the per-chain endpoint when the token search knows nothing',async()=>{
  const calls=[];
  global.fetch=async url=>{
    calls.push(String(url));
    if(String(url).includes('/latest/dex/tokens/'))return{ok:true,json:async()=>({pairs:[]})};
    return{ok:true,json:async()=>[{liquidity:null,marketCap:6749.74,priceChange:{h24:127}}]};
  };
  assert.deepEqual(figures(await fetchTokenStats('MINT')),{cap:'$6.7K',change:'+127.00%',up:true});
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

test('the token carries its own identity and links, so figures can be checked',()=>{
  const pair={liquidity:{usd:49701},marketCap:291397,priceChange:{h24:180},
    url:'https://dexscreener.com/solana/pool',
    baseToken:{address:'3rbmAAonWqxmPJ7rzQUHyZtqwqrF54EZa3pJgphmpump',name:'Zcash Cat',symbol:'ZCASHCAT'},
    info:{imageUrl:'https://cdn/img.png',websites:[{url:'https://zcashcatsol.fun'}],
      socials:[{type:'telegram',url:'https://t.me/zcashcatmeme'},{type:'twitter',url:'https://x.com/ZcashCatMeme'}]}};
  const stats=toStats(pair);
  assert.equal(stats.name,'Zcash Cat');
  assert.equal(stats.symbol,'ZCASHCAT');
  assert.equal(stats.twitter,'https://x.com/ZcashCatMeme');
  assert.equal(stats.telegram,'https://t.me/zcashcatmeme');
  assert.equal(stats.website,'https://zcashcatsol.fun/'); // normalised by URL parsing
  assert.equal(stats.chart,'https://dexscreener.com/solana/pool');
});
test('a token with no listed socials leaves those links absent, not broken',()=>{
  const stats=toStats({liquidity:{usd:1},marketCap:1000,priceChange:{h24:1},baseToken:{address:'X'},info:null});
  assert.equal(stats.twitter,undefined);
  assert.equal(stats.telegram,undefined);
  assert.equal(stats.address,'X');
});
test('the contract address is shown abbreviated but links to the full mint',()=>{
  const mint='3rbmAAonWqxmPJ7rzQUHyZtqwqrF54EZa3pJgphmpump';
  assert.equal(shortAddress(mint),'3rbm…pump');
  assert.equal(shortAddress('short'),'short');
  assert.ok(pumpFunUrl(mint).endsWith(mint));
});

test('a link is only rendered when it is plain https without credentials',()=>{
  assert.equal(safeLink('https://zcashcatsol.fun'),'https://zcashcatsol.fun/');
  for(const bad of ['http://plain.example','javascript:alert(1)','https://user:pw@evil.example','',null,undefined,42])
    assert.equal(safeLink(bad),undefined,`should reject ${String(bad)}`);
});
test('dollars stays legible from sub-cent prices up to millions',()=>{
  assert.equal(dollars(0.00000815),'$0.00000815');
  assert.equal(dollars(3_470_000),'$3.47M');
  assert.equal(dollars(635_560),'$635.56K');
  assert.equal(dollars(12.5),'$12.50');
  for(const bad of [null,undefined,NaN,Infinity,-1,'5'])assert.equal(dollars(bad),undefined);
});
test('price, volume and liquidity are carried through from the pool',()=>{
  const stats=toStats({liquidity:{usd:4190},marketCap:3900,priceChange:{h24:-96.3},
    priceUsd:'0.00000391',volume:{h24:3470000},baseToken:{address:'X'},info:null});
  assert.equal(stats.price,'$0.00000391');
  assert.equal(stats.volume,'$3.47M');
  assert.equal(stats.liquidity,'$4.19K');
  assert.equal(stats.up,false);
});
test('a pool missing price or volume omits them rather than showing zero',()=>{
  const stats=toStats({liquidity:null,marketCap:1000,priceChange:{h24:1},baseToken:{address:'X'},info:null});
  assert.equal(stats.price,undefined);
  assert.equal(stats.volume,undefined);
  assert.equal(stats.liquidity,undefined);
});

test('every extruded string is ASCII, since the 3D font renders gaps as "?"',()=>{
  const ascii=s=>/^[\x20-\x7e]*$/.test(s);
  for(const v of [1234,0,-1,NaN,987654321])assert.ok(ascii(formatCap(v)),`cap ${v}: ${formatCap(v)}`);
  for(const v of [8.24,-96.32,0,NaN])assert.ok(ascii(formatChange(v)),`change ${v}: ${formatChange(v)}`);
  assert.equal(formatChange(-96.32),'-96.32%');
});
