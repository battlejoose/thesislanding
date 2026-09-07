import type { Project } from './projects';

type RecordData=Record<string,unknown>;
const object=(value:unknown):RecordData=>value!==null&&typeof value==='object'&&!Array.isArray(value)?value as RecordData:{};
const clean=(value:unknown,max=120)=>typeof value==='string'?value.replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max):'';
const amount=(value:unknown)=>typeof value==='number'&&Number.isFinite(value)&&value>=0?value:null;
export const validContract=(value:string)=>/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
export function safeLink(value:unknown):string|null {
  try{const url=new URL(clean(value,2048));return url.protocol==='https:'&&!url.username&&!url.password?url.href:null;}catch{return null;}
}
const imageHosts=['gmgn.ai','ipfs.io','gateway.pinata.cloud','pump.mypinata.cloud','arweave.net','pump.fun','dexscreener.com','dexscreener.io','decentralized-content.com','cloudflare-ipfs.com'];
export function safeImageUrl(value:unknown):string|null {
  const raw=clean(value,2048),url=safeLink(raw.startsWith('ipfs://')?`https://ipfs.io/ipfs/${raw.slice(7).replace(/^ipfs\//,'')}`:raw);
  if(!url)return null;const parsed=new URL(url);
  return (!parsed.port||parsed.port==='443')&&imageHosts.some(host=>parsed.hostname===host||parsed.hostname.endsWith('.'+host))?url:null;
}
export function dollars(value:number|null):string {
  if(value===null)return 'N/A';
  return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',notation:value>=1000?'compact':'standard',maximumFractionDigits:value>=1000?2:value<1?8:2}).format(value);
}
export function normalizeToken(address:string,pumpValue:unknown,dexValue:unknown):{project:Project;imageSource:string|null}|null {
  const candidate=object(pumpValue),pump=candidate.mint===address?candidate:{};
  const pairs=(Array.isArray(dexValue)?dexValue:[]).map(object).filter(pair=>pair.chainId==='solana'&&object(pair.baseToken).address===address);
  pairs.sort((a,b)=>(amount(object(b.liquidity).usd)??0)-(amount(object(a.liquidity).usd)??0));
  const pair=pairs[0]??{},base=object(pair.baseToken),info=object(pair.info);
  const name=clean(pump.name,48)||clean(base.name,48);if(!name)return null;
  const symbol=clean(pump.symbol,18)||clean(base.symbol,18)||'N/A';
  const social=(kind:string)=>{
    const entry=(Array.isArray(info.socials)?info.socials:[]).map(object).find(link=>link.type===kind||link.platform===kind);
    return safeLink(entry?.url);
  };
  const imageSource=safeImageUrl(pump.image_uri)||safeImageUrl(info.imageUrl);
  const change=object(pair.priceChange).h24;
  const price=typeof pair.priceUsd==='string'&&pair.priceUsd.trim()!==''?amount(Number(pair.priceUsd)):null;
  const volume=amount(object(pair.volume).h24);
  const description=clean(pump.description,104)||`Price ${dollars(price)} / Vol 24h ${dollars(volume)}`;
  const websites=Array.isArray(info.websites)?info.websites:[];
  return {imageSource,project:{
    id:address,kind:'token',tokenAddress:address,dataState:'ready',name,ticker:symbol,category:'PUMP.FUN',description,
    // Pump's unqualified market_cap is denominated in SOL, never dollars.
    cap:dollars(amount(pump.usd_market_cap)??amount(pump.market_cap_usd)??amount(pair.marketCap)),
    change:typeof change==='number'&&Number.isFinite(change)?`${change>0?'+':''}${change.toFixed(2)}%`:'N/A',
    image:imageSource?`/api/tokens/${address}/image`:'/art/brooklyn.webp',imageAvailable:!!imageSource,video:null,icon:'',color:'#d7ad66',
    x:safeLink(pump.twitter)||social('twitter')||social('x'),telegram:safeLink(pump.telegram)||social('telegram'),
    website:safeLink(pump.website)||safeLink(object(websites[0]).url),tokenUrl:`https://pump.fun/coin/${address}`,
    price:dollars(price),volume:dollars(volume),liquidity:dollars(amount(object(pair.liquidity).usd)),updatedAt:new Date().toISOString(),
  }};
}

async function json(url:string):Promise<unknown> {
  try {
    const response=await fetch(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(7000),redirect:'manual'});
    if(!response.ok){console.warn('Token provider response',new URL(url).hostname,response.status);return null;}
    const body=await response.text();return body.length<1_000_000?JSON.parse(body):null;
  }catch(error){console.warn('Token provider unavailable',new URL(url).hostname,error instanceof Error?error.message:'Unknown error');return null;}
}
type TokenResult=NonNullable<ReturnType<typeof normalizeToken>>;
const cache=new Map<string,{expires:number;value:TokenResult}>(),pending=new Map<string,Promise<TokenResult|null>>();
export async function getToken(address:string):Promise<TokenResult|null> {
  if(!validContract(address))return null;
  const cached=cache.get(address);if(cached&&cached.expires>Date.now())return cached.value;
  const request=pending.get(address);if(request)return request;
  const next=(async()=>{
    const [pump,dex]=await Promise.all([json(`https://frontend-api-v3.pump.fun/coins/${address}`),json(`https://api.dexscreener.com/token-pairs/v1/solana/${address}`)]);
    const token=normalizeToken(address,pump,dex);
    if(token){if(cache.size>=128)cache.delete(cache.keys().next().value!);cache.set(address,{expires:Date.now()+60_000,value:token});}
    return token;
  })();pending.set(address,next);
  try{return await next;}finally{pending.delete(address);}
}

export async function getTokenImage(address:string):Promise<Response> {
  const token=await getToken(address);let url=token?.imageSource;
  if(!url)return new Response('Token image unavailable',{status:404});
  for(let step=0;step<3;step++){
    if(!safeImageUrl(url))break;
    const response:Response=await fetch(url,{signal:AbortSignal.timeout(8000),redirect:'manual',headers:{Accept:'image/webp,image/png,image/jpeg,image/*;q=0.8','User-Agent':'Thesis-Token-Showcase/1.0'}});
    if(response.status>=300&&response.status<400){const location:string|null=response.headers.get('Location');if(!location)break;url=new URL(location,url).href;continue;}
    const type=response.headers.get('Content-Type')?.split(';')[0]??'';
    if(!response.ok||!/^image\/(png|jpeg|webp|gif|avif)$/.test(type)||Number(response.headers.get('Content-Length'))>5_000_000){console.warn('Token image response',response.status,type);break;}
    const reader=response.body?.getReader();if(!reader)break;
    const chunks:Uint8Array[]=[];let size=0;
    while(true){const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.byteLength;if(size>5_000_000){await reader.cancel();return new Response('Image too large',{status:502});}chunks.push(chunk.value);}
    const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
    return new Response(bytes,{headers:{'Content-Type':type,'Cache-Control':'public, max-age=3600','X-Content-Type-Options':'nosniff'}});
  }
  return new Response('Token image unavailable',{status:502});
}
