import { appPath } from "./app-url.ts";
import { useState, type ImgHTMLAttributes, type SVGProps } from 'react';
import { usePlatformTokens } from './PlatformTokens.tsx';
import { UNKNOWN_TOKEN_LOGO } from './platform-tokens.ts';

function useLogo(secondary: boolean) {
  const tokens = usePlatformTokens();
  const logo = secondary ? tokens.secondaryLogo : tokens.primaryLogo;
  const [failed, setFailed] = useState<string>();
  return { logo: failed === logo ? UNKNOWN_TOKEN_LOGO : logo, fail: () => setFailed(logo) };
}

/** Image failures must never borrow another market's branding. */
export function PlatformTokenImage({ secondary = false, ...props }: Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'onError'> & { secondary?: boolean }) {
  const { logo, fail } = useLogo(secondary);
  return <img {...props} src={appPath(logo)} onError={fail} referrerPolicy="no-referrer" />;
}
export function PlatformTokenSvgImage({ secondary = false, ...props }: Omit<SVGProps<SVGImageElement>, 'href' | 'onError'> & { secondary?: boolean }) {
  const { logo, fail } = useLogo(secondary);
  return <image {...props} href={appPath(logo)} onError={fail} />;
}
