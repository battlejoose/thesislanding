import {useState} from 'react';
import {Coin} from './components.tsx';
import {tokenImageUrl} from './token-display.ts';
import type {WalletTokenRow} from './wallet-token-list.ts';

export function WalletTokenIcon({row}:{row:WalletTokenRow}) {
  const url=tokenImageUrl(row.imageUrl),[failed,setFailed]=useState('');
  if(url&&failed!==url)return <span className="coin wallet-token-image" aria-hidden="true"><img src={url} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={()=>setFailed(url)}/></span>;
  if(row.asset)return <Coin symbol={row.symbol}/>;
  return <span className="wallet-unlisted-icon" aria-hidden="true">{row.symbol.slice(0,3)}</span>;
}
