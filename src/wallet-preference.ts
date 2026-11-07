import type {TradingWalletMode} from './wallet-mode.ts';

const key='acidpump:trading-wallet-mode:v1';
type PreferenceStorage=Pick<Storage,'getItem'|'setItem'>;

export function loadWalletMode(storage?:PreferenceStorage):TradingWalletMode {
  try{return (storage??globalThis.localStorage).getItem(key)==='browser'?'browser':'instant';}
  catch{return 'instant';}
}

export function saveWalletMode(mode:TradingWalletMode,storage?:PreferenceStorage):void {
  try{(storage??globalThis.localStorage).setItem(key,mode);}
  catch{/* A blocked browser store must not prevent switching wallets. */}
}
