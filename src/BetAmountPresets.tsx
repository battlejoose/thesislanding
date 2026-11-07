import {tokenAmountInput} from './withdrawal.ts';

export function BetAmountPresets({available,decimals,disabled,onSelect}:{
  available:bigint;decimals:number;disabled?:boolean;onSelect:(amount:string)=>void;
}) {
  return <div className="bet-amount-presets" role="group" aria-label="Bet amount presets">
    {[25,50,100].map(percent=><button key={percent} type="button"
      disabled={disabled||available<=0n}
      aria-label={`Use ${percent}% of available token balance`}
      onClick={()=>onSelect(tokenAmountInput(available*BigInt(percent)/100n,decimals))}
    >{percent===100?'Max':`${percent}%`}</button>)}
  </div>;
}
