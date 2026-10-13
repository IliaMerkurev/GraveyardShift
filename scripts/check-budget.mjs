import { stat,readFile } from 'node:fs/promises';
const file='dist/playable/index.html';const bytes=(await stat(file)).size;const html=await readFile(file,'utf8');
if(bytes>=5_000_000)throw new Error(`FAIL: ${bytes} bytes >= hard limit 5,000,000`);
if(/<script\b[^>]*src=|<link\b[^>]*href="(?!data:)/.test(html))throw new Error('FAIL: HTML depends on a neighboring resource');
console.log(`${bytes<=2_000_000?'PASS':'WARNING'}: ${bytes} bytes; target <= 2,000,000; hard limit < 5,000,000.`);
