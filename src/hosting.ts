/** One live USDC venue. Requests go directly to the service in production,
 * preserving wallet payloads, streaming and per-player rate limits. */
export const BACKEND_ORIGIN='https://acidpump-mainnet-test.fly.dev';
export const BACKEND_PREFIX='/thesis';
export function backendUrl(path:string,development=false){
 if(!/^\/(?:api\/|deployment\.json(?:$|\?))/.test(path))return path;
 return development?path:BACKEND_ORIGIN+BACKEND_PREFIX+path;
}
