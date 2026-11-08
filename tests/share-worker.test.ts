import test from 'node:test';
import assert from 'node:assert/strict';
import {handleShare, sharePage} from '../worker/share.ts';

const id='a'.repeat(64), url=`https://thesis.casino/share/${id}`;
const shell=`<!doctype html><html><head><title>Old</title><meta name="description" content="old"><meta property="og:image" content="old"><meta name="twitter:card" content="summary"><link rel="canonical" href="old"><script type="module" src="/assets/app.js"></script></head><body><div id="root"></div></body></html>`;
const saved=`<meta name="description" content="SOL Long · DEMO\n+$3.57 &amp; &quot;safe&quot; $&amp; @ThesisPMF"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">`;
const assets={ASSETS:{fetch:async()=>new Response(shell,{headers:{'content-type':'text/html','content-security-policy':"frame-ancestors 'none'"}})}};

test('share pages expose Thesis metadata before JavaScript and retain the current application',()=>{
  const html=sharePage(shell,saved,id);
  assert.match(html, /<title>Thesis PERPS position<\/title>/);
  assert.equal((html.match(/name="description"/g)??[]).length,1);
  assert.equal((html.match(/name="twitter:card"/g)??[]).length,1);
  assert.match(html,/name="twitter:card" content="summary_large_image"/);
  assert.match(html,/name="twitter:site" content="@ThesisPMF"/);
  assert.ok(html.includes(`property="og:image" content="${url}.png"`));
  assert.ok(html.includes(`name="twitter:image" content="${url}.png"`));
  assert.ok(html.includes(`rel="canonical" href="${url}"`));
  assert.ok(html.includes('+$3.57 &amp; &quot;safe&quot; $&amp; @ThesisPMF'));
  assert.ok(html.includes('src="/assets/app.js"'));
  assert.throws(()=>sharePage(shell,'<html>missing</html>',id));
  assert.throws(()=>sharePage(shell,saved.replace('1200','9999'),id));
  assert.throws(()=>sharePage(shell,saved,'bad-id'));
});
test('apex and www serve the matching Thesis venue without forwarding cookies or authorization',async()=>{
  for(const origin of ['https://thesis.casino','https://www.thesis.casino']){
    let requests=0;
    const response=await handleShare(new Request(origin+'/share/'+id,{headers:{cookie:'private',authorization:'private'}}),assets,async(input,init)=>{
      requests++;
      assert.equal(input,`https://acidpump-mainnet-test.fly.dev/thesis/share/${id}`);
      assert.deepEqual(init?.headers,{Accept:'text/html'});
      assert.equal(init?.redirect,'manual');
      return new Response(saved,{headers:{'content-type':'text/html'}});
    });
    assert.equal(response.status,200);assert.equal(requests,1);
    assert.equal(response.headers.get('content-security-policy'),"frame-ancestors 'none'");
    assert.ok((await response.text()).includes(url+'.png'));
  }
});
test('PNG and HEAD requests preserve image bytes and crawler access',async()=>{
  const bytes=new Uint8Array([137,80,78,71]);
  for(const method of ['GET','HEAD']){
    const response=await handleShare(new Request(url+'.png',{method}),assets,async(input,init)=>{
      assert.equal(input,`https://acidpump-mainnet-test.fly.dev/thesis/share/${id}.png`);
      assert.equal(init?.method,method);
      return new Response(method==='HEAD'?null:bytes,{headers:{'content-type':'image/png'}});
    });
    assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/png');
    assert.deepEqual(new Uint8Array(await response.arrayBuffer()),method==='HEAD'?new Uint8Array():bytes);
  }
  const head=await handleShare(new Request(url,{method:'HEAD'}),assets,async()=>new Response(saved,{headers:{'content-type':'text/html'}}));
  assert.equal(head.status,200);assert.equal(await head.text(),'');
});
test('missing snapshots, invalid paths, failures and writes never become successful share cards',async()=>{
  const unexpected=async()=>{throw Error('Unexpected network request');};
  assert.equal((await handleShare(new Request(url,{method:'POST'}),assets,unexpected)).status,405);
  assert.equal((await handleShare(new Request('https://thesis.casino/share/invalid'),assets,unexpected)).status,404);
  assert.equal((await handleShare(new Request(url),assets,async()=>new Response('missing',{status:404}))).status,404);
  assert.equal((await handleShare(new Request(url),assets,unexpected)).status,502);
  assert.equal((await handleShare(new Request(url+'.png'),assets,async()=>new Response(shell,{headers:{'content-type':'text/html'}}))).status,502);
  assert.equal(await (await handleShare(new Request('https://thesis.casino/docs'),assets,unexpected)).text(),shell);
});
