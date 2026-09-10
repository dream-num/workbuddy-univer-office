import {defineConfig} from 'vite';
export default defineConfig({build:{outDir:'dist/test-host',emptyOutDir:true,target:'es2022',lib:{entry:'tests/browser/mcp-host.ts',name:'OfficeProtocolTestHost',formats:['iife'],fileName:()=> 'host.js'}}});
