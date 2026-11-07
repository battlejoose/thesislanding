import test from 'node:test';
import assert from 'node:assert/strict';
import {BACKEND_ORIGIN,backendUrl} from '../src/hosting.ts';
import {serviceOrigin,apiUrl,thesisSkin,thesisPreview} from '../src/app-url.ts';

test('production configuration, RPC, streaming and signed request URLs select the same Thesis venue',()=>{
 for(const route of ['/deployment.json','/deployment.json?v=1','/api/rpc','/api/events?compact=2','/api/er/prepare','/api/sponsor/submit']){
  assert.equal(backendUrl(route),BACKEND_ORIGIN+'/thesis'+route);
  assert.equal(backendUrl(route,true),route);
 }
 assert.equal(apiUrl('/api/state'),BACKEND_ORIGIN+'/thesis/api/state');
 assert.equal(thesisSkin,true);assert.equal(thesisPreview,false);
});
test('username challenge identity uses the service origin without the venue path',()=>{
 assert.equal(serviceOrigin('https://thesis.casino'),'https://acidpump-mainnet-test.fly.dev');
 assert.equal(new URL(serviceOrigin('https://www.thesis.casino')).pathname,'/');
});
test('page, asset and external wallet destinations are never rewritten as service requests',()=>{
 for(const route of ['/','/docs#/intro','/thesis-brand/mark.png','https://wallet.example/api/approve','//wallet.example/api/approve'])
  assert.equal(backendUrl(route),route);
});
