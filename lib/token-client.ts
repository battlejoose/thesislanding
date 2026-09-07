import type { Project } from './projects';

// Share decoded images between startup and the 3D tiles for the same lifetime
// as the image endpoint's browser cache. No browser APIs run during SSR.
const images = new Map<string, { pending: Promise<HTMLImageElement | null>; expires: number }>();

export function loadTokenImage(src: string): Promise<HTMLImageElement | null> {
  const cached = images.get(src);
  if (cached && cached.expires > Date.now()) return cached.pending;

  const pending = new Promise<HTMLImageElement | null>(resolve => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.fetchPriority = 'high';
    image.decoding = 'async';
    let settled = false;
    const finish = (result: HTMLImageElement | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      image.onload = image.onerror = null;
      resolve(result);
    };
    const timeout = setTimeout(() => finish(null), 8000);
    image.onload = () => {
      if (!image.naturalWidth) { finish(null); return; }
      if (typeof image.decode === 'function') {
        void image.decode().then(() => finish(image), () => finish(null));
      } else finish(image);
    };
    image.onerror = () => finish(null);
    image.src = src;
  });
  images.set(src, { pending, expires: Date.now() + 3_600_000 });
  // Failed images can be retried by the next metadata refresh.
  void pending.then(image => { if (!image && images.get(src)?.pending === pending) images.delete(src); });
  return pending;
}

export async function fetchTokenProject(address:string,signal:AbortSignal):Promise<Project> {
  signal.throwIfAborted();
  const controller=new AbortController(),cancel=()=>controller.abort(signal.reason);
  const timeout=setTimeout(()=>controller.abort(new DOMException('Token request timed out','TimeoutError')),10_000);
  signal.addEventListener('abort',cancel,{once:true});
  try {
    const response=await fetch(`/api/tokens/${address}`,{signal:controller.signal,cache:'no-store',headers:{Accept:'application/json'}});
    if(!response.ok)throw new Error('Token unavailable');
    const project:Project=await response.json();
    if(project.id!==address||project.tokenAddress!==address||project.kind!=='token')throw new Error('Unexpected token');
    return project;
  }finally{clearTimeout(timeout);signal.removeEventListener('abort',cancel);}
}

export async function prepareTokenProject(address:string,signal:AbortSignal):Promise<Project> {
  signal.throwIfAborted();
  // The image URL is known from the address; start it alongside the metadata.
  const src=`/api/tokens/${address}/image`,image=loadTokenImage(src);
  const project=await fetchTokenProject(address,signal);
  if(project.imageAvailable!==false)await (project.image===src?image:loadTokenImage(project.image));
  signal.throwIfAborted();
  return project;
}

export const tokenRefreshDelay=(failures:number)=>failures===0?60_000:Math.min(30_000,2_000*2**Math.min(failures-1,4));
