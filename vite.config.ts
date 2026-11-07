import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {publicDocs} from './scripts/public-docs.ts';
import {BACKEND_ORIGIN,BACKEND_PREFIX} from './src/hosting.ts';

process.env.THESIS_SKIN='1';
const proxy={target:BACKEND_ORIGIN,changeOrigin:true,
 rewrite:(path:string)=>BACKEND_PREFIX+path,
 configure:(server:any)=>server.on('proxyReq',(request:any)=>request.setHeader('origin',BACKEND_ORIGIN))};
export default defineConfig({
 base:'/',
 plugins:[react(),publicDocs()],
 resolve:{dedupe:['react','react-dom'],alias:{buffer:'buffer/'}},
 define:{global:'globalThis','process.env.NODE_DEBUG':'undefined'},
 server:{proxy:{'/api':proxy,'/deployment.json':proxy}},
 build:{outDir:'dist'},
});
