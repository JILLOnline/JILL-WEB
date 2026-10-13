#!/usr/bin/env node
// Reproducible, explicitly allowlisted public-image import from JILL LIVE.
// Run through GitHub Actions; NO Shopify credentials or customer data are used.
// Downloaded images become actual WORK theme assets (not live CDN dependencies).
import fs from 'node:fs/promises';
import path from 'node:path';
const cdn='https://cdn.shopify.com/s/files/1/0761/2376/7027/files/';
const images=[
 ['jill-brand-logo.png','LOGO_2025.png?v=1779668367','png'],
 ['jill-brand-favicon.png','FAVICON.png?v=1749920339','png'],
 ['jill-home-hero.jpg','IMG_3114.jpg?v=1779665241','jpeg'],
 ['jill-home-pinatas.jpg','il_fullxfull.8053170302_qxwm.jpg?v=1779718757','jpeg'],
 ['jill-home-party-favors.jpg','il_fullxfull.8031248115_vxc6.jpg?v=1779718825','jpeg'],
 ['jill-home-kids.jpg','il_fullxfull.8100943069_nlcf.jpg?v=1779718765','jpeg'],
 ['jill-home-party-supplies.jpg','il_fullxfull.7164221845_9fyb.jpg?v=1779718820','jpeg'],
 ['jill-home-apparel.jpg','il_fullxfull.7984254024_9ok8.jpg?v=1779718813','jpeg']
];
const isPng=buf=>buf.length>8&&buf.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
const isJpg=buf=>buf.length>4&&buf[0]===255&&buf[1]===216&&buf.at(-2)===255&&buf.at(-1)===217;
const output=path.resolve('assets');
const outputAllowed=new Set(images.map(x=>x[0]));
await fs.mkdir(output,{recursive:true});
for(const [filename,source,type] of images){
 if(!outputAllowed.has(filename)||!/^jill-[a-z0-9-]+\.(?:png|jpg)$/.test(filename))throw Error('Unexpected filename');
 const url=new URL(source,cdn);
 if(url.hostname!=='cdn.shopify.com'||!url.pathname.startsWith('/s/files/1/0761/2376/7027/files/'))throw Error('Unexpected source host/path');
 const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(25000),headers:{'User-Agent':'JILL-WORK-brand-parity-audit/1.0'}});
 if(!response.ok)throw Error(filename+' HTTP '+response.status);
 const length=Number(response.headers.get('content-length'));
 if(length>12000000)throw Error(filename+' exceeds 12MB budget');
 const data=Buffer.from(await response.arrayBuffer());
 if(data.length<256||data.length>12000000||!(type==='png'?isPng(data):isJpg(data)))
  throw Error(filename+' is not valid expected image format or size');
 await fs.writeFile(path.join(output,filename),data);
 console.log(filename+': '+data.length+' bytes, verified '+type);
}
console.log('Eight curated JILL brand/product photos ready for WORK theme assets; no Shopify writes.');
