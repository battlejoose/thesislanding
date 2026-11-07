/** Exact bigint formatting for the small wallet trigger; full lists keep full amounts. */
export function compactBalance(atoms:bigint,decimals:number):string {
  const unit=10n**BigInt(decimals),sign=atoms<0n?'-':'',amount=atoms<0n?-atoms:atoms;
  for(const [scale,suffix] of [[1_000_000_000n,'b'],[1_000_000n,'m'],[1_000n,'k']] as const){
    if(amount<unit*scale)continue;
    const hundredths=amount*100n/(unit*scale);
    return sign+`${hundredths/100n}${hundredths%100n?'.'+String(hundredths%100n).padStart(2,'0').replace(/0$/,''):''}${suffix}`;
  }
  return new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(Number(atoms)/Number(unit));
}
