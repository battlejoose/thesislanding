import type {Row} from './client.ts';

export const mainnetContextKeys=['realQuoteReserve','poolSourceSlot','usdPerQuoteAtomE21','conversionPublishTime','conversionSourceSlot'] as const;
/** The renamed fields have identical wire values for existing SOL observations.
 * USD/atom × 1e21 equals SOL/USD × 1e12 because SOL has 1e9 atoms. */
export function normalizeMainnetRow(row:Row):Row {
  if(!row?.mainnet)return row;
  const context={...row.mainnet};let changed=false;
  for(const [old,key]of [['solUsdE12','usdPerQuoteAtomE21'],['solPublishTime','conversionPublishTime'],['solSourceSlot','conversionSourceSlot']] as const){
    if(context[old]===undefined)continue;
    if(context[key]!==undefined&&String(context[key])!==String(context[old]))throw Error('Conflicting collateral conversion context');
    context[key]=context[old];delete context[old];changed=true;
  }
  return changed?{...row,mainnet:context}:row;
}
