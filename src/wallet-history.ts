import { HISTORY_LIMIT } from './history-limit.ts';

export type WalletTransfer={id:string;signature:string;slot:number;at:number|null;type:string;direction:'in'|'out'|'self';
  from:string|null;to:string|null;mint:string;amount:string;decimals:number};
export type WalletHistoryPage={owner:string;checkedAt:number;transfers:WalletTransfer[];cursor:string|null};
export const NATIVE_SOL_HISTORY_MINT='So11111111111111111111111111111111111111111';
/** Pages can overlap. Deduplicate before limiting and retain the newest slots;
 * stable ordering within a slot preserves the provider's instruction order. */
export function mergeWalletHistory(previous: readonly WalletTransfer[], page: WalletHistoryPage): WalletHistoryPage {
  const transfers = [...new Map([...previous, ...page.transfers].map(row => [row.id, row])).values()]
    .sort((a, b) => b.slot - a.slot).slice(0, HISTORY_LIMIT);
  return {...page, transfers, cursor: transfers.length >= HISTORY_LIMIT ? null : page.cursor};
}
export function transferAmount(amount:string,decimals:number){
  const padded=amount.padStart(decimals+1,'0'),whole=decimals?padded.slice(0,-decimals):padded;
  const fraction=decimals?padded.slice(-decimals).replace(/0+$/,''):'';
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g,',')+(fraction?'.'+fraction:'');
}
