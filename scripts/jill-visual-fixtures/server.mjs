import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(root,'../../');
const screenshotDir=path.join(repo,'docs/evidence/jill-hq-myjill-synthetic-visuals');
const previews=['hq-home','hq-requests','hq-request-detail','hq-messages','hq-contact-us',
  'hq-catalog','hq-settings','myjill-overview','myjill-custom-orders','myjill-messages',
  'myjill-rewards','myjill-coupons'];
const widths=[390,768,1440];
const screenshotNames=new Set(previews.flatMap(screen=>widths.map(width=>`${screen}-${width}.png`)));
const styles=new Set(['hq-theme.css','hq-home.css','inbox.css','request-detail.css',
  'request-actions.css','hq-messages.css','hq-catalog.css']);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8','.png':'image/png'};
let saved=0;
const server=createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://127.0.0.1');
    if(req.method==='GET'){
      const screen=url.pathname.slice(1);
      const file=url.pathname==='/'||previews.includes(screen)
        ?path.join(root,'preview.html')
        :url.pathname==='/preview.js'?path.join(root,'preview.js')
        :url.pathname==='/preview.css'?path.join(root,'preview.css')
        :url.pathname.startsWith('/styles/')&&styles.has(path.basename(url.pathname))
          ?path.join(repo,'services/jill-order-desk/app-home/app/styles',path.basename(url.pathname))
          :null;
      if(!file){res.writeHead(404).end('not found');return;}
      const body=await readFile(file);
      res.writeHead(200,{'content-type':types[path.extname(file)]||'application/octet-stream',
        'cache-control':'no-store','content-length':body.length});
      res.end(body);return;
    }
    if(req.method==='POST'&&url.pathname.startsWith('/__screenshot/')){
      const name=path.basename(url.pathname.slice('/__screenshot/'.length));
      if(!screenshotNames.has(name)||req.headers['content-type']!=='image/png'){
        res.writeHead(400).end('invalid screenshot request');return;
      }
      const chunks=[];let size=0;
      for await(const chunk of req){
        size+=chunk.length;
        if(size>5_000_000){res.writeHead(413).end('screenshot too large');return;}
        chunks.push(chunk);
      }
      const image=Buffer.concat(chunks);
      if(image.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'){
        res.writeHead(400).end('invalid PNG');return;
      }
      await mkdir(screenshotDir,{recursive:true});
      await writeFile(path.join(screenshotDir,name),image);
      saved++;
      res.writeHead(201,{'content-type':'application/json'}).end(JSON.stringify({saved,name,total:saved}));
      return;
    }
    res.writeHead(405).end('method not allowed');
  }catch(error){
    console.error(error);
    if(!res.headersSent)res.writeHead(500);
    res.end('preview server error');
  }
});
server.listen(4179,'127.0.0.1',()=>console.log(
  `Synthetic JILL visual preview: http://127.0.0.1:4179/ (local only; ${screenshotNames.size} screenshot slots)`
));
