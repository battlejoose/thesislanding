import { getToken, validContract } from '@/lib/token-data';

export const dynamic='force-dynamic';

export async function GET(_request:Request,{params}:{params:Promise<{ca:string}>}) {
  const {ca}=await params;
  if(!validContract(ca))return Response.json({error:'Invalid Solana contract address.'},{status:400});
  const token=await getToken(ca,_request.signal);
  if(!token)return Response.json({error:'Token data is temporarily unavailable.'},{status:503,headers:{'Cache-Control':'no-store'}});
  return Response.json(token.project,{headers:{'Cache-Control':'no-store'}});
}
