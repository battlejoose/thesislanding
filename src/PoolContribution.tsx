import {useState} from 'react';
import {parseUnits} from './math.ts';
import {contributionReward} from './pool-contribution.ts';
import './pool-contribution.css';
export function PoolContribution({balance,decimals,poolUsd,queued,busy,status,onContribute}:{balance:bigint;decimals:number;poolUsd:bigint|null;queued:boolean;busy:boolean;status?:string;onContribute:(amount:bigint,minimum:bigint)=>void}) {
  const [input,setInput]=useState(''),[agreed,setAgreed]=useState(false);
  let amount=0n,reward=0n;
  try{amount=parseUnits(input,decimals);if(poolUsd!==null&&amount>0n)reward=contributionReward(amount,poolUsd,queued);}catch{}
  const valid=agreed&&amount>0n&&amount<=balance&&reward>0n&&poolUsd!==null;
  const display=(value:bigint)=>(Number(value)/10**decimals).toLocaleString(undefined,{maximumFractionDigits:2});
  return <section className="pool-contribution" aria-label="Contribute SDICE">
    <h3>Power the SDICE pool</h3>
    <p>Give SDICE directly to the payout pool. Earn twice the pSDICE of an equivalent loss{queued?' — 4× base rewards while FIFO claims are queued':''}.</p>
    <label>SDICE amount<input inputMode="decimal" value={input} onChange={e=>setInput(e.target.value)} disabled={busy}/></label>
    <small>In your mainnet wallet: {display(balance)} SDICE</small>
    <p aria-live="polite">{poolUsd===null?'Waiting for a current pool quote':`Estimated reward: ${display(reward)} pSDICE`}</p>
    <p><strong>pSDICE is non-transferable.</strong> Stake it in this market to earn rewards.</p>
    <label className="contribution-consent"><input type="checkbox" checked={agreed} onChange={e=>setAgreed(e.target.checked)} disabled={busy}/>I understand this contribution is permanent. The SDICE cannot be withdrawn, and pSDICE cannot be transferred.</label>
    <button disabled={busy||!valid} onClick={()=>onContribute(amount,reward*99n/100n||1n)}>{busy?(status||'Contributing…'):`Contribute SDICE · earn ${queued?'4':'2'}× pSDICE`}</button>
    <small>The confirmed reward uses the pool value and FIFO status before your contribution. The transaction rejects a reward more than 1% below this estimate.</small>
  </section>;
}
