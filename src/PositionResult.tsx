import type { CSSProperties } from 'react';
import type { AssetInfo, Row } from './client.ts';
import { usePlatformTokens } from './PlatformTokens.tsx';
import { PnlLock } from './PnlLock.tsx';
import { positionLock } from './position-lock.ts';
import { positionProfitTokens, positionReturnPercent } from './position-profit-display.ts';
import { storyAmountText } from './settlement-story.ts';

export function PositionResult({ position, pnl, poolToken, quote, now, ownershipText, onStake }: {
  position: Row; pnl: bigint | null; poolToken?: AssetInfo; quote?: Row; now: number;
  ownershipText: string; onStake: () => void;
}) {
  const tokens = usePlatformTokens(), lock = positionLock(position);
  const percent = positionReturnPercent(pnl, position.entryValue);
  const dollarText = storyAmountText({ atoms: pnl, symbol: 'USD', decimals: 6, usd: true, signed: true });
  const winning = pnl !== null && pnl > 0n;
  const profit = positionProfitTokens(position, pnl, quote, now);
  const symbol = poolToken?.symbol ?? tokens.primary;
  const tokenText = storyAmountText({ atoms: profit.total, symbol, decimals: poolToken?.decimals ?? 6, signed: true });
  const legacy = (profit.legacyUsd ?? 0n) > 0n
    ? storyAmountText({ atoms: profit.legacyUsd, symbol: 'USDC', decimals: 6, usd: true, signed: true }) + ' USDC' : '';
  const rewardText = winning
    ? (profit.total === 0n && legacy ? legacy : `${profit.estimated ? '≈ ' : ''}${tokenText} $${symbol}${legacy ? ' + ' + legacy : ''}`)
    : ownershipText;
  return <div className="result" style={{ '--pnl-em': dollarText.length * .58 + percent.length * .26 + .85 } as CSSProperties}>
    <strong className={'pnl-value ' + (pnl === null ? '' : pnl < 0n ? 'negative' : 'positive')}
      title={position.state === 0 ? lock === 'price' ? 'Exit price locked · USD profit is finalized after collateral valuation on Solana' : 'Estimated P&L in USD' : 'Settled P&L in USD · profit pays in the market backing token'}>
      <span className="pnl-number"><PnlLock state={lock}/>{dollarText}</span>
      <span className="position-return" title="Profit or loss as a percentage of the original bet’s USD value">{percent}</span>
    </strong>
    {winning ? <span className="ownership-reward backing-profit" style={{ '--reward-em': rewardText.length * .57 } as CSSProperties}
      title={profit.estimated ? 'Estimated total profit tokens: confirmed tokens plus unpaid profit at current spot. The unpaid amount changes until paid.' : 'Confirmed profit received · original collateral is returned separately'}>{rewardText}</span>
      : <button className="ownership-reward" style={{ '--reward-em': ownershipText.length * .57 } as CSSProperties}
        title={position.state === 0 ? 'Estimated ownership reward if closed now' : 'Ownership earned by this position · stake for revenue share'} onClick={onStake}>{ownershipText}</button>}
  </div>;
}
