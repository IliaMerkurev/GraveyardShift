import { readFile,writeFile,mkdir,readdir } from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {inlineScript,inlineStyle} from './inline-source.ts';
const root=path.resolve('dist/raw');
let html=await readFile(path.join(root,'index.html'),'utf8');
for(const match of [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/g)]){
  const script=await readFile(path.join(root,match[1]),'utf8');
  html=inlineScript(html,match[0],script);
}
for(const match of [...html.matchAll(/<link\b[^>]*href="([^"]+\.css)"[^>]*>/g)]){
  const css=await readFile(path.join(root,match[1]),'utf8');html=inlineStyle(html,match[0],css);
}
html=html.replace('<head>','<head><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\'; style-src \'unsafe-inline\'; img-src data: blob:; connect-src \'none\'; base-uri \'none\'; form-action \'none\'">');
if(/<script\b[^>]*src=|<link\b[^>]*href="(?!data:)|sourceMappingURL|\/\@vite\/|__rocksnake/.test(html))throw new Error('Standalone output contains a dependency, dev hook, or source map');
const embedded=html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
if(!embedded)throw new Error('Missing embedded module');
const syntax=spawnSync(process.execPath,['--check','--input-type=module'],{input:embedded,encoding:'utf8'});
if(syntax.status!==0)throw new Error(`Embedded JavaScript syntax check failed: ${syntax.stderr}`);
await mkdir('dist/playable',{recursive:true});
const existing=await readdir('dist/playable');if(existing.some(f=>f!=='index.html'))throw new Error('Unexpected files in playable directory');
await writeFile('dist/playable/index.html',html);
console.log(`Standalone playable: ${Buffer.byteLength(html)} bytes; one file; production read-only hooks stripped.`);
