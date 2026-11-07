import {backendUrl, BACKEND_ORIGIN} from './hosting.ts';
export function appPath(path:string,base=import.meta.env?.BASE_URL??'/'){
 if(!path.startsWith('/')||path.startsWith('//')||base==='/')return path;
 const prefix=base.replace(/\/$/,'');return path===prefix||path.startsWith(prefix+'/')?path:prefix+path;
}
export const appRoute=(path:string)=>path;
export const thesisSkin=true;
export const sdiceSkin=true;
export const appName='Thesis PERPS';
export const thesisPreview=false;
export const SDICE_SERVICE_ORIGIN=BACKEND_ORIGIN;
export const serviceOrigin=(_pageOrigin:string)=>BACKEND_ORIGIN;
export const apiUrl=(path:string)=>backendUrl(path,import.meta.env?.DEV===true);
export const appFetch:typeof globalThis.fetch=(input,init)=>globalThis.fetch(typeof input==='string'?apiUrl(input):input,init);
