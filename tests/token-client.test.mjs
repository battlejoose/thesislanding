import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchTokenProject,tokenRefreshDelay} from '../lib/token-client.ts';

const address='4GBmCJRcmPiwnydKqdGG17fx4CkojpQHeiktDzbNpump';
const project={id:address,tokenAddress:address,kind:'token',dataState:'ready',name:'Harvey The Mini Bull'};

test('token loads request fresh JSON and reject mismatched token responses',async()=>{
  const original=globalThis.fetch;
  try{
    globalThis.fetch=async(url,options)=>{assert.equal(url,`/api/tokens/${address}`);assert.equal(options.cache,'no-store');return Response.json(project);};
    assert.deepEqual(await fetchTokenProject(address,new AbortController().signal),project);
    globalThis.fetch=async()=>Response.json({...project,tokenAddress:'wrong'});
    await assert.rejects(fetchTokenProject(address,new AbortController().signal),/Unexpected token/);
  }finally{globalThis.fetch=original;}
});

test('a hanging response times out and the next token load succeeds',async()=>{
  const originalFetch=globalThis.fetch,originalTimeout=globalThis.setTimeout;let deadline;
  try{
    globalThis.setTimeout=(fn,delay)=>{deadline=delay;return originalTimeout(fn,0);};
    globalThis.fetch=async(url,{signal})=>new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));
    await assert.rejects(fetchTokenProject(address,new AbortController().signal),{name:'TimeoutError'});
    assert.equal(deadline,10_000);
    globalThis.setTimeout=originalTimeout;globalThis.fetch=async()=>Response.json(project);
    assert.deepEqual(await fetchTokenProject(address,new AbortController().signal),project);
  }finally{globalThis.fetch=originalFetch;globalThis.setTimeout=originalTimeout;}
});

test('leaving the page cancels its request, and failed loads retry promptly with a bound',async()=>{
  const original=globalThis.fetch,controller=new AbortController();
  try{
    globalThis.fetch=async(url,{signal})=>new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));
    const pending=fetchTokenProject(address,controller.signal);controller.abort();
    await assert.rejects(pending,{name:'AbortError'});
    assert.deepEqual([0,1,2,3,4,5,20].map(tokenRefreshDelay),[60_000,2000,4000,8000,16000,30000,30000]);
  }finally{globalThis.fetch=original;}
});
