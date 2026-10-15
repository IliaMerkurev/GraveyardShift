import {build} from 'vite';
import {writeFile} from 'node:fs/promises';
const result=await build({configFile:false,build:{write:false,lib:{entry:'scripts/dungeon-kit-export-browser.ts',formats:['es'],fileName:'export'},minify:true},logLevel:'warn'});
const bundle=Array.isArray(result)?result[0]:result;
const js=bundle.output.find(v=>v.type==='chunk').code;
const html=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Dungeon model kit export</title><style>body{background:#20262a;color:#eee;font:18px system-ui;max-width:800px;margin:60px auto;padding:24px}button{padding:16px;margin:8px;border:0;border-radius:8px;background:#bd8a47;color:#141719;font:inherit}</style><h1>Dungeon model kit</h1><p>Export the exact procedural painted atlas and all fourteen model assemblies with UVs and PBR materials. Runs entirely offline. Import the GLB into Blender or another glTF-compatible editor.</p><button id="glb">Download textured GLB</button><button id="atlas">Download painted atlas PNG</button><script type="module">${js.replaceAll('</script','<\\/script')}</script></html>`;
await writeFile('art/dungeon/export-textured-kit.html',html);console.log(`Standalone developer exporter: ${Buffer.byteLength(html)} bytes`);
