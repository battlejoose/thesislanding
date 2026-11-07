import { appRoute } from "./app-url.ts";
export function publicRoute(path: string): 'landing' | 'docs' | 'trade' {
  const normalized = appRoute(path).replace(/\/+$/, '') || '/';
  if (normalized === '/') return 'landing';
  if (normalized === '/docs') return 'docs';
  return 'trade';
}
