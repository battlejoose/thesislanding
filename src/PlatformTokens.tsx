import { createContext, useContext, useMemo } from 'react';
import { DEVNET_TOKENS, type PlatformTokens } from './platform-tokens.ts';
import { appPath, sdiceSkin, thesisSkin } from './app-url.ts';

export const PlatformTokensContext = createContext<PlatformTokens>(thesisSkin ? {
  primary:'USDC',secondary:'pPERPS',reward:'PERPS',primaryLogo:'/tokens/usdc.svg',secondaryLogo:'/thesis-brand/mark.png',rewardLogo:'/thesis-brand/mark.png',
} : sdiceSkin ? {
  primary: 'SDICE', secondary: 'pSDICE', primaryLogo: '/tokens/sdice.png', secondaryLogo: '/tokens/sdice.png',
} : DEVNET_TOKENS);
export const usePlatformTokens = () => {
  const tokens = useContext(PlatformTokensContext);
  return useMemo(() => ({...tokens, primaryLogo: appPath(tokens.primaryLogo), secondaryLogo: appPath(tokens.secondaryLogo),
    rewardLogo: tokens.rewardLogo ? appPath(tokens.rewardLogo) : undefined}), [tokens]);
};
