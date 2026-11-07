import test from 'node:test';
import assert from 'node:assert/strict';
import type { AssetInfo, Snapshot } from '../src/client.ts';
import { platformMetrics } from '../src/metrics-model.ts';
import { PERPS_MINT } from '../src/perps-market.ts';
import { settlementStory } from '../src/settlement-story.ts';

const now = 1_800_000_000_000;
function snapshot(): Snapshot {
  return {
    pools: [{ key:'pool', id:0, settlement:'usdc', perpsRewards:true, trades:'10', queueHead:'0', queueTail:'0', queueUsd:'0' }],
    assets: [{key:'usdc',id:104,decimals:6}, {key:'perps',id:112,mint:PERPS_MINT,decimals:6}],
    inventories: [{key:'inventory',pool:'pool',asset:'usdc',treasury:'94560000'}],
    ownershipPools: [{key:'ownership',pool:'pool',supply:'1000000',rewardPool:'30000000000',feePending:'0'}],
    ownershipTraders: [{key:'trader',pool:'pool',issued:'1000000',claimed:'22603610000'}],
    perpsRevenues: [{key:'revenue',pool:'pool',perpsBurned:'15349709107',burnUsdc:'999000000',burnSpent:'1459231'}],
    quotes: [104,112].map(id=>({key:`quote-${id}`,id,quoteCollateral:id===104,price:id===104?'1000000000000':'80000000',publishTime:String(now/1000)})),
    markets:[],feeds:[],positions:[],serverTime:now,snapshotAgeMs:0,contextSlot:42,
  };
}
test('PERPS totals use actual claims and burn counters, valued independently of the USDC treasury',()=>{
  const model=platformMetrics(snapshot(),now);
  assert.equal(model.poolUsd,94.56);
  assert.equal(model.rewardsPaidTokens,22603.61);
  assert.equal(model.rewardsPaidUsd,1.8082888);
  assert.equal(model.burnedTokens,15349.709107);
  assert.equal(model.burnedUsd,1.22797672856);
  assert.equal(model.burnComplete,true); // Does not depend on a truncated close history.
  assert.equal(model.rewardsFunded,52603.61);
});
test('PERPS prices never fall back to USDC and absent burn records never become zero',()=>{
  const base=snapshot();
  for(const quotes of [base.quotes.slice(0,1),[base.quotes[0],{...base.quotes[1],publishTime:String(now/1000-30)}]]){
    const model=platformMetrics({...base,quotes},now);
    assert.equal(model.poolUsd,94.56);
    assert.equal(model.rewardsPaidTokens,22603.61);
    assert.equal(model.rewardsPaidUsd,null);
    assert.equal(model.burnedTokens,15349.709107);
    assert.equal(model.burnedUsd,null);
  }
  for(const perpsRevenues of [[],[{...base.perpsRevenues![0],pool:'other'}],[{...base.perpsRevenues![0],perpsBurned:'bad'}]]){
    const model=platformMetrics({...base,perpsRevenues},now);
    assert.equal(model.burnedTokens,null);assert.equal(model.burnComplete,false);
  }
  assert.equal(platformMetrics({...base,perpsRevenues:[{...base.perpsRevenues![0],perpsBurned:'0'}]},now).burnedTokens,0);
});
test('reward metadata and claim completeness remain required for financial totals',()=>{
  const base=snapshot();
  const missing=platformMetrics({...base,assets:base.assets.slice(0,1)},now);
  assert.equal(missing.poolUsd,94.56);assert.equal(missing.rewardsPaidTokens,null);assert.equal(missing.burnedTokens,null);
  assert.equal(platformMetrics({...base,ownershipTraders:[]},now).rewardsPaidTokens,null);
  const nine=platformMetrics({...base,assets:[base.assets[0],{...base.assets[1],decimals:9}]},now);
  assert.equal(nine.rewardsPaidTokens,22.60361);
  assert.equal(nine.rewardsPaidUsd,0.0018082888);
});
test('a close receipt describes USDC routing without inventing PERPS swap or burn output',()=>{
  const usd={symbol:'USDC',mint:'usdc',decimals:6} as AssetInfo;
  const args={collateral:usd,poolToken:usd,rewardToken:{symbol:'PERPS',decimals:6},pnl:-1000000n,ownership:90000000n,
    ownershipSymbol:'pPERPS',position:{key:'loss',state:1,margin:'1000000',loss:'1000000',returned:'0',profit:'0',remaining:'0',
      swappedOut:'900000',settlementReceipt:{acidReceived:'980000',poolTokens:'900000',stakerTokens:'80000',burnedTokens:'0'}}};
  const story=settlementStory(args),split=story.find(s=>s.id==='allocation')!.split!;
  assert.equal(split[0].symbol,'USDC');assert.equal(split[0].atoms,900000n);
  assert.equal(split[1].symbol,'USDC');assert.equal(split[1].atoms,80000n);assert.equal(split[1].label,'Revenue routing');
  assert.equal(split[2].symbol,'PERPS');assert.equal(split[2].atoms,null);
  assert.equal(story.find(s=>s.id==='ownership')!.amount!.symbol,'pPERPS');
  const queued=settlementStory({...args,position:{...args.position,settlementReceipt:{...args.position.settlementReceipt,stakerTokens:'0'}}});
  assert.equal(queued.find(s=>s.id==='allocation')!.split![2].atoms,0n);
});
