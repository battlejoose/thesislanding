import { primaryAsset, type Deployment } from './client.ts';
import { mainnetRelease } from './mainnet-release.ts';
import { assetImage, tokenImageUrl, type TokenDisplays } from './token-display.ts';
import {NATIVE_MINT} from '@solana/spl-token';
import {MAINNET_USDC} from './deployment-profile.ts';
import {isPerpsMarket,perpsRewardAsset} from './perps-market.ts';

export const SDICE_PRIMARY_MINT = '4nCmpwne7hCoWTSpAd54uENmCgHJrHTyn4DMPCEMpump';
export type PlatformTokens = Readonly<{ primary: string; secondary: string; primaryLogo: string; secondaryLogo: string; venueMint?: string; reward?:string; rewardLogo?:string }>;
export const UNKNOWN_TOKEN_LOGO = '/tokens/market.svg';
export const DEVNET_TOKENS: PlatformTokens = Object.freeze({ primary: 'ACIDPUMP', secondary: 'aPUMP',
  primaryLogo: '/acidpump.svg', secondaryLogo: '/acidpump-teal.svg' });

/** Labels belong to a deployment, never to a token supplied by a trader. A
 * created market is labelled by its own registered backing token. */
export function platformTokens(deployment: Pick<Deployment, 'cluster' | 'assets' | 'secondaryTokenSymbol' | 'programId'> & Partial<Pick<Deployment, 'modular' | 'venue'>>, displays: TokenDisplays = {}): PlatformTokens {
  if (deployment.cluster === 'mainnet-beta' && deployment.modular) {
    // The root SDICE identity must remain pinned even in another token's view.
    const root = platformTokens({ ...deployment, modular: false, venue: undefined });
    if (!deployment.venue) return root;
    const core = primaryAsset(deployment);
    if (!core || !core.collateral || core.sourceMint !== core.mint || core.sourcePool !== core.dexPool)
      throw Error('Mainnet market backing token is unavailable');
    const nativeLogo=core.mint===NATIVE_MINT.toBase58()?'/tokens/sol.svg':core.mint===MAINNET_USDC?'/tokens/usdc.svg':undefined;
    const logo = nativeLogo ?? assetImage(displays, core) ?? tokenImageUrl(deployment.venue.logo) ?? UNKNOWN_TOKEN_LOGO;
    if(isPerpsMarket(deployment)) {
      perpsRewardAsset(deployment as Deployment);
      return {primary:'USDC',secondary:'pPERPS',reward:'PERPS',venueMint:core.mint,primaryLogo:logo,
        secondaryLogo:'/thesis-brand/mark.png',rewardLogo:'/thesis-brand/mark.png'};
    }
    return { primary: core.symbol, secondary: `p${core.symbol}`, venueMint: core.mint,
      primaryLogo: logo, secondaryLogo: logo };
  }
  if (deployment.modular) {
    const core = primaryAsset({ assets: deployment.assets, venue: deployment.venue });
    if (!core) throw Error('Market backing token is unavailable');
    const logo = assetImage(displays, core) ?? tokenImageUrl(deployment.venue?.logo) ?? UNKNOWN_TOKEN_LOGO;
    return { primary: core.symbol, secondary: deployment.venue ? `p${core.symbol}` : deployment.secondaryTokenSymbol ?? `p${core.symbol}`,
      ...(deployment.venue ? { venueMint: core.mint } : {}),
      primaryLogo: deployment.venue ? logo : core.symbol === 'SDICE' ? '/tokens/sdice.png' : DEVNET_TOKENS.primaryLogo,
      secondaryLogo: deployment.venue ? logo : DEVNET_TOKENS.secondaryLogo };
  }
  if (deployment.cluster !== 'mainnet-beta') return DEVNET_TOKENS;
  const core = deployment.assets.find(asset => asset.feedId === 102);
  const release = mainnetRelease(deployment.programId);
  if (core?.mint !== release.primaryMint || core.symbol !== release.primarySymbol || core.dexPool !== release.primaryPool || core.tokenProgram !== release.primaryTokenProgram ||
      (deployment.secondaryTokenSymbol !== undefined && deployment.secondaryTokenSymbol !== release.secondarySymbol))
    throw Error(`Mainnet deployment must use ${release.primarySymbol} and ${release.secondarySymbol}`);
  return { primary: release.primarySymbol, secondary: release.secondarySymbol,
    primaryLogo: release.primaryLogo, secondaryLogo: release.secondaryLogo };
}

/** Resolve authored tutorial copy; financial amounts and token identities are untouched. */
export function platformCopy(text: string, tokens: PlatformTokens) {
  return text.replace(/\bACIDPUMP\b/g, tokens.primary).replace(/\baPUMP\b/g, tokens.secondary);
}
