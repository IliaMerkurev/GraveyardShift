import {createServer} from 'node:http';import{readFile}from'node:fs/promises';
const port=Number(process.env.PORT||4173);
createServer(async(req,res)=>{if(req.url!=='/'&&req.url!=='/index.html'){res.writeHead(404);res.end();return;}try{const html=await readFile('dist/playable/index.html');res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(html);}catch{res.writeHead(503);res.end('Run npm run build:playable first.');}}).listen(port,'127.0.0.1',()=>console.log(`Standalone preview at http://127.0.0.1:${port}`));
