import test from 'node:test';
import assert from 'node:assert/strict';
import {positionShareText, positionShareUrl, hostedPositionShare} from '../src/position-share.ts';
import {THESIS_X_PROFILE} from '../src/thesis-share.ts';

const id = 'a'.repeat(64), path = `/share/${id}`;
test('Thesis X drafts tag ThesisPMF and carry one canonical snapshot link', () => {
  const text = positionShareText({state:1,long:true,market:'SOL',margin:'5000000',decimals:6,collateral:'USDC',entryValue:'5000000',leverage:100,pnl:'-1000000',poolTokens:'900000',ownershipTokens:'90000000',platformToken:'USDC',ownershipToken:'pPERPS',platformDecimals:6}, true, true);
  assert.match(text, /SOL Long · CLOSED · 100×/);
  assert.match(text, /Pool \/ ownership: 0.9 \$USDC → 90 \$pPERPS\n@ThesisPMF$/);
  assert.doesNotMatch(text, /SoltoshiDice|acidpump|https?:/i);
  const draft = new URL(positionShareUrl(text, 'https://thesis.casino' + path));
  assert.equal(draft.origin + draft.pathname, 'https://x.com/intent/tweet');
  assert.equal(draft.searchParams.get('text'), text);
  assert.equal(draft.searchParams.get('url'), 'https://thesis.casino' + path);
  assert.equal(THESIS_X_PROFILE, 'https://x.com/ThesisPMF');
});
test('Thesis canonicalizes validated backend venue links on apex, www and localhost', () => {
  for (const origin of ['https://thesis.casino','https://www.thesis.casino','http://127.0.0.1:5310']) {
    for (const prefix of ['', '/m/USDC', '/thesis', '/thesis/m/USDC']) {
      const url = 'https://acidpump-mainnet-test.fly.dev' + prefix + path;
      assert.deepEqual(hostedPositionShare({url,imageUrl:url+'.png'},origin,true,true), {url:'https://thesis.casino'+path,imageUrl:'https://thesis.casino'+path+'.png'});
    }
    const url = 'https://www.thesis.casino'+path;
    assert.equal(hostedPositionShare({url,imageUrl:url+'.png'},origin,true,true).url, 'https://thesis.casino'+path);
  }
});
test('Thesis rejects mismatched images, other venues and spoofed domains before rewriting', () => {
  const url = 'https://acidpump-mainnet-test.fly.dev/m/USDC'+path;
  for (const bad of ['https://evil.test'+path, 'https://thesis.casino.evil.test'+path, 'https://acidpump-mainnet-test.fly.dev/m/WIF'+path, url+'?x=1', 'https://user@thesis.casino'+path, 'http://thesis.casino'+path]) {
    assert.throws(()=>hostedPositionShare({url:bad,imageUrl:bad+'.png'},'https://thesis.casino',true,true));
  }
  assert.throws(()=>hostedPositionShare({url,imageUrl:url.replace(id,'b'.repeat(64))+'.png'},'https://thesis.casino',true,true));
});
