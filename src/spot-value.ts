import type {Row} from './client.ts';
const U64=(1n<<64n)-1n,U128=(1n<<128n)-1n;
/** Pool accounting uses authenticated reserve ratios. Collateral safety keeps
 * using sellUsd and its executable-sale checks. Never turn a cached quote fresh. */
export function spotUsd(amount:bigint,q:Row):bigint {
  if(amount<0n||amount>U64)throw Error('Spot amount outside u64');
  if(amount===0n)return 0n;
  if(q.quoteCollateral&&q.id===104)return amount;
  if(q.mainnet&&!q.spot)throw Error('Spot conversion reserves unavailable');
  const s=q.spot??{base:q.baseReserve,quote:q.quoteReserve,usdBase:1,usdQuote:1};
  const [base,quote,usdBase,usdQuote]=[s.base,s.quote,s.usdBase,s.usdQuote].map(BigInt);
  if([base,quote,usdBase,usdQuote].some(n=>n<=0n||n>U64))throw Error('Spot reserves unavailable');
  const intermediate=amount*quote/base, product=intermediate*usdBase;
  const value=product/usdQuote;
  if(product>U128||value>U64)throw Error('Spot value outside contract range');
  return value;
}
export function spotPayout(remaining:bigint,available:bigint,q:Row) {
  if(remaining<=0n||remaining>U64||available<=0n||available>U64)throw Error('Invalid spot payout');
  const value=spotUsd(available,q);
  if(value<=0n)throw Error('Payout inventory below one micro-dollar');
  if(value<remaining)return {tokens:available,debitUsd:value};
  let lo=1n,hi=available;
  while(lo<hi){const mid=lo+(hi-lo)/2n;if(spotUsd(mid,q)>=remaining)hi=mid;else lo=mid+1n;}
  return {tokens:lo,debitUsd:remaining};
}
/** Invert the two integer reserve ratios without valuing a fictitious u64-max
 * inventory, which can overflow for high-priced tokens. */
export function spotClaimTokens(remaining:bigint,q:Row):bigint {
  if(remaining<=0n||remaining>U64)throw Error('Invalid spot claim');
  spotUsd(1n,q); // validate the same authenticated reserve fields
  if(q.quoteCollateral&&q.id===104)return remaining;
  const s=q.spot??{base:q.baseReserve,quote:q.quoteReserve,usdBase:1,usdQuote:1};
  const [base,quote,usdBase,usdQuote]=[s.base,s.quote,s.usdBase,s.usdQuote].map(BigInt);
  const quoteAtoms=(remaining*usdQuote+usdBase-1n)/usdBase;
  const tokens=(quoteAtoms*base+quote-1n)/quote;
  if(tokens<=0n||tokens>U64||spotUsd(tokens,q)<remaining)throw Error('Spot claim outside contract range');
  return tokens;
}
