import type { Row } from "./client.ts";
import { PRODUCTION_POLICY } from './production-policy.ts';
export const MIN_ENTRY_USD = BigInt(PRODUCTION_POLICY.minimumEntryUsd) * 1_000_000n;
export const MAX_NOTIONAL_USD = BigInt(PRODUCTION_POLICY.maximumWalletNotionalUsd) * 1_000_000n;
export const MAX_POSITION_NOTIONAL_USD = BigInt(PRODUCTION_POLICY.maximumPositionNotionalUsd) * 1_000_000n;
export const OI_HEADROOM_USD = BigInt(PRODUCTION_POLICY.marketHeadroomUsd) * 1_000_000n;
export function poolExposureLimit(poolUsd:bigint):bigint {
  if(poolUsd<0n)throw Error('Invalid pool value');
  if(poolUsd<=100_000_000_000n)return 1_000_000_000_000n;
  if(poolUsd>=1_000_000_000_000n)return MAX_NOTIONAL_USD;
  return poolUsd*10n;
}
/** Mirrors the publisher-authenticated admission observation, not a browser price. */
export function poolExposureValue(row:Row|undefined,now=Date.now()):bigint|null {
  if(!Number.isFinite(now)||now<=0)return null;
  if(!row)return 0n; // Conservative floor while a new venue initializes.
  try {
    // The onchain age check uses whole Unix seconds.
    now=Math.floor(now/1000)*1000;
    const at=Number(row.observedAt)*1000;
    if(BigInt(row.sourceSlot)<=0n||!Number.isSafeInteger(at)||at<=0||at>now||now-at>15_000)return null;
    const value=BigInt(row.usd);return value>=0n&&value<=0xffffffffffffffffn?value:null;
  }catch{return null;}
}
export function canOpenUsd(
  value: bigint,
  leverage: number,
  existing: bigint,
  market: Row | undefined,
  long: boolean,
  poolUsd:bigint|null = 0n,
) {
  if (
    !market || poolUsd===null || poolUsd<0n ||
    value < MIN_ENTRY_USD ||
    existing < 0n ||
    !Number.isInteger(leverage) ||
    leverage < 1 ||
    leverage > PRODUCTION_POLICY.maximumLeverage
  )
    return false;
  const n = value * BigInt(leverage);
  const limit=poolExposureLimit(poolUsd);
  return (
    n <= limit &&
    existing + n <= limit &&
    n + BigInt(long ? market.longOi : market.shortOi) <=
      BigInt((long ? market.longCap : market.shortCap) ?? 0)
  );
}
