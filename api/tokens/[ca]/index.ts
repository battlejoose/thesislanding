// Vercel Edge Function mirroring app/api/tokens/[ca]/route.ts.
//
// The Vercel deployment is a static export, which emits no route handlers, so
// the same logic is exposed here. Both entry points delegate to lib/token-data
// and stay in step because neither holds any logic of its own.
import { getToken, validContract } from '../../../lib/token-data';

export const config = { runtime: 'edge' };

export default async function handler(request: Request): Promise<Response> {
  const ca = new URL(request.url).pathname.split('/').filter(Boolean).pop() ?? '';
  if (!validContract(ca)) return Response.json({ error: 'Invalid Solana contract address.' }, { status: 400 });
  const token = await getToken(ca, request.signal);
  if (!token) return Response.json({ error: 'Token data is temporarily unavailable.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  return Response.json(token.project, { headers: { 'Cache-Control': 'no-store' } });
}
