import {defineConfig} from 'vite';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({plugins:[tailwindcss()],root:'src/viewer',worker:{rollupOptions:{output:{inlineDynamicImports:true}}},build:{manifest:true,outDir:'../../dist/viewer',emptyOutDir:true,target:'es2022',rollupOptions:{input:{main:'src/viewer/index.html',snapshot:'src/viewer/snapshot.html'}}}});
