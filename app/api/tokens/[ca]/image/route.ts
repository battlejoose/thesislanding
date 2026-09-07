import { getTokenImage, validContract } from '@/lib/token-data';

export async function GET(_request:Request,{params}:{params:Promise<{ca:string}>}) {
  const {ca}=await params;
  if(!validContract(ca))return new Response('Invalid contract address',{status:400});
  try{return await getTokenImage(ca);}catch(error){console.warn('Token image unavailable',error instanceof Error?error.message:'Unknown error');return new Response('Token image unavailable',{status:502});}
}
