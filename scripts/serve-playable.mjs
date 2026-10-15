import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
const port=Number(process.env.PORT||4173);
const paths=new Map([['/','index.html'],['/index.html','index.html'],['/media/intro-portrait.mp4','media/intro-portrait.mp4'],['/media/intro-landscape.mp4','media/intro-landscape.mp4']]);
createServer(async(req,res)=>{
  const file=paths.get(new URL(req.url,'http://localhost').pathname);
  if(!file){res.writeHead(404);res.end();return;}
  try{
    const data=await readFile(`dist/playable/${file}`),video=file.endsWith('.mp4');
    const headers={'Content-Type':video?'video/mp4':'text/html; charset=utf-8','Cache-Control':'no-store','Accept-Ranges':'bytes'};
    const range=req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
    if(range){const start=Number(range[1]),end=Math.min(range[2]?Number(range[2]):data.length-1,data.length-1);if(start>end){res.writeHead(416,{'Content-Range':`bytes */${data.length}`});res.end();return;}res.writeHead(206,{...headers,'Content-Range':`bytes ${start}-${end}/${data.length}`,'Content-Length':end-start+1});res.end(data.subarray(start,end+1));return;}
    res.writeHead(200,{...headers,'Content-Length':data.length});res.end(data);
  }catch{res.writeHead(503);res.end('Run npm run build:playable first.');}
}).listen(port,'127.0.0.1',()=>console.log(`Playable preview at http://127.0.0.1:${port}`));
