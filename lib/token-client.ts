import type { Project } from './projects';

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

export const tokenRefreshDelay=(failures:number)=>failures===0?60_000:Math.min(30_000,2_000*2**Math.min(failures-1,4));
