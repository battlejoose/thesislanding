import type {AssetInfo,Row} from './client.ts';
import type {WalletTokenSnapshot,WalletToken} from './wallet-discovery.ts';
import {discoveredTokenStatus} from './wallet-discovery.ts';
import {walletTokenRows,walletTokenAction} from './wallet-token-list.ts';
import {WalletTokenIcon} from './WalletTokenIcon.tsx';
import type {TokenDisplays} from './token-display.ts';

export function BetTokenList({assets,balances,quotes,quoteMint,now,ready,selected,select,discovered,error,backingRequired,register,displays}:{
  assets:AssetInfo[];balances:Record<string,bigint>;quotes:Row[];quoteMint:string;now:number;ready:boolean;selected?:string;
  select:(asset:AssetInfo)=>void;discovered?:WalletTokenSnapshot;error?:string;backingRequired:(asset:AssetInfo)=>boolean;
  register?:(token:WalletToken)=>void;displays?:TokenDisplays;
}) {
  const number=(n:number)=>new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(n);
  const dollars=(n:bigint)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(n)/1e6);
  return <>
    <div className="token-options bet-token-options">
      {walletTokenRows(assets,balances,quotes,quoteMint,discovered,displays,now).map(row=>{
        const action=walletTokenAction(row),a=row.asset;
        const actionable=action==='select'||action==='register'&&!!register;
        return <button key={row.mint} aria-pressed={selected===row.mint} disabled={!actionable}
          className={!actionable?'unavailable-bet-token':undefined} title={`${row.name} · ${row.mint}`}
          aria-label={action==='select'?`Bet with ${row.symbol}`:action==='register'?`Register ${row.symbol}`:`${row.symbol}: ${row.token?discoveredTokenStatus(row.token):'Trading unavailable'}`}
          onClick={()=>{if(action==='select'&&a)select(a);else if(action==='register'&&row.token)register?.(row.token);}}>
          <WalletTokenIcon row={row}/>
          <span className="bet-token-details">${row.symbol}<small>{number(Number(row.balance)/10**row.decimals)} available</small>
            {a&&backingRequired(a)&&<small className="token-backing-required">Requires bet backing</small>}
            {row.token&&<small>{action==='register'&&register?'Register · 0.05 SOL':discoveredTokenStatus(row.token)}</small>}
          </span>
          <span className="bet-token-values">{selected===row.mint&&<span className="chosen">✓</span>}<small className="bet-token-usd" title="Estimated USD balance value">{ready&&row.usd!==undefined?dollars(row.usd):'—'}</small></span>
        </button>;
      })}
    </div>
    {error&&<small className="wallet-discovery-status" role="status">{error}</small>}
  </>;
}
