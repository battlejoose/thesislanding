import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTokenImage,prepareTokenProject} from '../lib/token-client.ts';
import {CONSTRUCTION_OVERRIDES,INITIAL_CONSTRUCTION_PROJECTS} from '../lib/construction-projects.ts';

function fakeImages() {
  const original=globalThis.Image,created=[];
  globalThis.Image=class {
    naturalWidth=64; width=64; height=64;
    constructor(){created.push(this);}
    decode(){return Promise.resolve();}
  };
  return {created,restore(){if(original===undefined)delete globalThis.Image;else globalThis.Image=original;}};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const metadata=address=>({id:address,tokenAddress:address,kind:'token',dataState:'ready',image:`/api/tokens/${address}/image`,imageAvailable:true});

test('initial HTML can request configured token images without waiting for metadata',()=>{
  for(const [index,project] of INITIAL_CONSTRUCTION_PROJECTS.entries()){
    if(project.kind==='token')assert.equal(project.image,CONSTRUCTION_OVERRIDES[index]?.image??`/api/tokens/${project.tokenAddress}/image`);
    else assert.equal(project.image,'/art/brooklyn.webp');
  }
});

test('custom artwork starts immediately and survives missing provider imagery and metadata refreshes',async()=>{
  const mock=fakeImages(),originalFetch=globalThis.fetch,address='custom-artwork';
  const overrides={name:'SoltoshiDICE',ticker:'SDICE',image:'/art/custom-test.png',imageAvailable:true,website:'https://soltoshidice.wtf/'};
  try{
    globalThis.fetch=async()=>Response.json({...metadata(address),name:'Provider name',ticker:'OLD',image:'/art/brooklyn.webp',imageAvailable:false,website:null,cap:'$123'});
    let settled=false,releaseDecode;
    const pending=prepareTokenProject(address,new AbortController().signal,overrides).then(project=>{settled=true;return project;});
    assert.equal(mock.created.length,1);assert.equal(mock.created[0].src,overrides.image);
    mock.created[0].decode=()=>new Promise(resolve=>{releaseDecode=resolve;});
    mock.created[0].onload();await tick();assert.equal(settled,false);
    releaseDecode();const project=await pending;
    for(const [key,value] of Object.entries(overrides))assert.equal(project[key],value);
    assert.equal(project.cap,'$123');assert.equal(project.tokenAddress,address);
    assert.deepEqual(await prepareTokenProject(address,new AbortController().signal,overrides),project);
    assert.equal(mock.created.length,1,'refresh must reuse the custom image without requesting Pump artwork');
  }finally{mock.restore();globalThis.fetch=originalFetch;}
});

test('image and metadata load together, and startup waits for decoding before returning the tile',async()=>{
  const mock=fakeImages(),originalFetch=globalThis.fetch,address='parallel-image',project=metadata(address);
  let releaseMetadata,releaseDecode,settled=false;
  try{
    globalThis.fetch=()=>{
      assert.equal(mock.created.length,1,'the image starts before metadata resolves');
      return new Promise(resolve=>{releaseMetadata=()=>resolve(Response.json(project));});
    };
    const pending=prepareTokenProject(address,new AbortController().signal).then(p=>{settled=true;return p;});
    const image=mock.created[0];
    assert.equal(image.src,project.image);assert.equal(image.fetchPriority,'high');assert.equal(image.crossOrigin,'anonymous');
    image.decode=()=>new Promise(resolve=>{releaseDecode=resolve;});
    releaseMetadata();image.onload();await tick();
    assert.equal(settled,false,'download completion alone is not image readiness');
    releaseDecode();assert.deepEqual(await pending,project);
    assert.equal(await loadTokenImage(project.image),image,'the renderer reuses the decoded image');
    assert.equal(mock.created.length,1);
    assert.equal(image.onload,null);assert.equal(image.onerror,null);
  }finally{mock.restore();globalThis.fetch=originalFetch;}
});

test('one broken image does not discard token metadata or prevent a later retry',async()=>{
  const mock=fakeImages(),originalFetch=globalThis.fetch,address='failed-image',project=metadata(address);
  try{
    globalThis.fetch=async()=>Response.json(project);
    const pending=prepareTokenProject(address,new AbortController().signal);
    mock.created[0].onerror();assert.deepEqual(await pending,project);
    const retry=loadTokenImage(project.image);assert.equal(mock.created.length,2);
    mock.created[1].onload();assert.equal(await retry,mock.created[1]);
  }finally{mock.restore();globalThis.fetch=originalFetch;}
});

test('a hung image settles within its deadline and does not retain event handlers',async()=>{
  const mock=fakeImages(),originalTimeout=globalThis.setTimeout;let deadline;
  try{
    globalThis.setTimeout=(fn,delay)=>{deadline=delay;return originalTimeout(fn,0);};
    assert.equal(await loadTokenImage('/hung-image'),null);
    assert.equal(deadline,8000);assert.equal(mock.created[0].onload,null);assert.equal(mock.created[0].onerror,null);
  }finally{mock.restore();globalThis.setTimeout=originalTimeout;}
});

test('missing image metadata releases startup, and leaving while decoding cannot return stale data',async()=>{
  const mock=fakeImages(),originalFetch=globalThis.fetch;
  try{
    const absent={...metadata('absent-image'),imageAvailable:false,image:'/art/brooklyn.webp'};
    globalThis.fetch=async()=>Response.json(absent);
    assert.deepEqual(await prepareTokenProject('absent-image',new AbortController().signal),absent);
    mock.created[0].onerror();

    const controller=new AbortController();globalThis.fetch=async()=>Response.json(metadata('aborted-image'));
    const pending=prepareTokenProject('aborted-image',controller.signal);
    await tick();controller.abort();mock.created[1].onload();
    await assert.rejects(pending,{name:'AbortError'});
  }finally{mock.restore();globalThis.fetch=originalFetch;}
});

test('decoded images expire with the proxy cache instead of remaining stale for the entire visit',async()=>{
  const mock=fakeImages(),originalNow=Date.now;
  try{
    const first=loadTokenImage('/expiring-image');mock.created[0].onload();await first;
    const now=Date.now();Date.now=()=>now+3_600_001;
    const next=loadTokenImage('/expiring-image');assert.equal(mock.created.length,2);
    mock.created[1].onload();assert.equal(await next,mock.created[1]);
  }finally{mock.restore();Date.now=originalNow;}
});
