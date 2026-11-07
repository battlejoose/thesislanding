import { emissionQuote } from './emissions.ts';
/** Entire contribution goes to the pool; reward is twice an equivalent loss, including FIFO. */
export function contributionReward(amount:bigint,poolUsd:bigint,queued=false) {
  if(amount<=0n||amount>0xffffffffffffffffn||poolUsd<0n)throw Error('Invalid contribution');
  return (queued?4n:2n)*emissionQuote(amount,0n,poolUsd,0n,0n).issued;
}
