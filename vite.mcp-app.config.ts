import {defineConfig} from 'vite';
import {readFileSync} from 'node:fs';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({define:{'process.env.NODE_ENV':JSON.stringify('production')},plugins:[tailwindcss(),{name:'office-app-html',generateBundle(){this.emitFile({type:'asset',fileName:'index.html',source:readFileSync('src/mcp-app/index.html','utf8').replaceAll('__OFFICE_LOGO__',`data:image/png;base64,${readFileSync('assets/univer-office.png').toString('base64')}`)});}}],build:{outDir:'dist/mcp-app',emptyOutDir:true,target:'es2022',lib:{entry:'src/mcp-app/main.ts',name:'WorkBuddyOfficeApp',formats:['iife'],fileName:()=> 'app.js',cssFileName:'app'}}});
