import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeToken,validContract,safeLink,safeImageUrl,dollars,getToken,getTokenImage} from '../lib/token-data.ts';
import {CONSTRUCTION_TOKENS,INITIAL_CONSTRUCTION_PROJECTS} from '../lib/construction-projects.ts';

const address=CONSTRUCTION_TOKENS[0];
const pump={mint:address,name:'Harvey The Mini Bull',symbol:'Harvey',usd_market_cap:79218.2,market_cap:746.58,image_uri:'https://gmgn.ai/external-res/token.webp',twitter:'https://x.com/token',website:'https://example.com'};
const pair={chainId:'solana',baseToken:{address,name:'Harvey The Mini Bull',symbol:'Harvey'},liquidity:{usd:22000},marketCap:78000,priceUsd:'0.000078',priceChange:{h24:-8.5},volume:{h24:120000}};

test('Construction has exactly one configured token and two unavailable Soon tiles',()=>{
  assert.equal(CONSTRUCTION_TOKENS.length,3);assert.equal(CONSTRUCTION_TOKENS.filter(Boolean).length,1);
  assert.equal(address,'4GBmCJRcmPiwnydKqdGG17fx4CkojpQHeiktDzbNpump');
  for(const p of INITIAL_CONSTRUCTION_PROJECTS.slice(1)){
    assert.equal(p.kind,'soon');for(const field of ['name','ticker','description','category','cap','change'])assert.equal(p[field],'N/A');
    assert.equal(p.video,null);assert.equal(p.x,null);assert.equal(p.telegram,null);
  }
});
test('metadata and USD cap come from the exact Pump mint; market metrics use the liquid pool',()=>{
  const tiny={...pair,liquidity:{usd:3},priceChange:{h24:9000}};
  const result=normalizeToken(address,pump,[tiny,pair]);assert.ok(result);
  assert.equal(result.project.name,pump.name);assert.equal(result.project.cap,dollars(79218.2));
  assert.equal(result.project.change,'-8.50%');assert.equal(result.project.telegram,null);
  assert.equal(result.project.image,`/api/tokens/${address}/image`);assert.equal(result.imageSource,pump.image_uri);
});
test('never interpret SOL market_cap or FDV as USD market cap',()=>{
  const result=normalizeToken(address,{...pump,usd_market_cap:undefined},[]);
  assert.equal(result.project.cap,'N/A');assert.equal(result.project.change,'N/A');
  assert.equal(normalizeToken(address,null,[{...pair,marketCap:undefined,fdv:500000}]).project.cap,'N/A');
});
test('reject wrong-mint/wrong-chain records, and preserve truthful partial data',()=>{
  assert.equal(normalizeToken(address,{...pump,mint:'different'},[{...pair,chainId:'ethereum'}]),null);
  const fallback=normalizeToken(address,null,[pair]);assert.equal(fallback.project.name,pump.name);assert.equal(fallback.project.imageAvailable,false);
  const partial=normalizeToken(address,{...pump,usd_market_cap:0},[]);assert.equal(partial.project.cap,'$0.00');
});
test('external metadata cannot inject scripts or request arbitrary/private image hosts',()=>{
  assert.ok(validContract(address));assert.equal(validContract('../etc/passwd'),false);
  assert.equal(safeLink('javascript:alert(1)'),null);assert.equal(safeLink('https://user:pass@example.com'),null);
  for(const url of ['http://localhost/a','https://127.0.0.1/a','https://gmgn.ai.evil.example/a','https://evil.example/a','https://gmgn.ai:8443/a'])assert.equal(safeImageUrl(url),null);
  assert.equal(safeImageUrl('ipfs://bafytest/image.png'),'https://ipfs.io/ipfs/bafytest/image.png');
});
test('concurrent refreshes share one bounded request per upstream and cache the result',async()=>{
  const original=globalThis.fetch;let calls=0;
  globalThis.fetch=async(url)=>{calls++;return Response.json(String(url).includes('pump.fun')?pump:[pair]);};
  try{
    const [a,b]=await Promise.all([getToken(address),getToken(address)]);
    assert.equal(a.project.tokenAddress,address);assert.deepEqual(a,b);assert.equal(calls,2);
    await getToken(address);assert.equal(calls,2);
  }finally{globalThis.fetch=original;}
});

test('image delivery uses edge-compatible fetching and returns same-origin image bytes',async()=>{
  const original=globalThis.fetch;
  globalThis.fetch=async(url,options)=>{
    assert.equal(options.redirect,'manual');assert.equal(options.headers['User-Agent'],'Thesis-Token-Showcase/1.0');
    return new Response(new Uint8Array([1,2,3]),{headers:{'Content-Type':'image/webp'}});
  };
  try{const response=await getTokenImage(address);assert.equal(response.status,200);assert.equal(response.headers.get('Content-Type'),'image/webp');assert.equal((await response.arrayBuffer()).byteLength,3);}
  finally{globalThis.fetch=original;}
});
test('image delivery rejects redirects to untrusted hosts before making another request',async()=>{
  const original=globalThis.fetch;let calls=0;
  globalThis.fetch=async()=>{calls++;return new Response(null,{status:302,headers:{Location:'http://127.0.0.1/private'}});};
  try{const response=await getTokenImage(address);assert.equal(response.status,502);assert.equal(calls,1);}
  finally{globalThis.fetch=original;}
});
