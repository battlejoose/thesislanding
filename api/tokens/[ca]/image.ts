// Vercel Edge Function mirroring app/api/tokens/[ca]/image/route.ts.
// Proxying the image server-side is what lets the tile use it as a WebGL
// texture: the token image CDNs send no CORS header of their own.
import { getTokenImage, validContract } from '../../../lib/token-data';

export const config = { runtime: 'edge' };

export default async function handler(request: Request): Promise<Response> {
  const parts = new URL(request.url).pathname.split('/').filter(Boolean);
  const ca = parts[parts.length - 2] ?? '';
  if (!validContract(ca)) return new Response('Invalid contract address', { status: 400 });
  try { return await getTokenImage(ca); }
  catch { return new Response('Token image unavailable', { status: 502 }); }
}
