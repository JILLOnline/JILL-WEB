#!/usr/bin/env node
// Read-only source/WORK storefront pages and menu snapshot.
// Deliberately excludes customer-account menus and account-extension identifiers.
import fs from 'node:fs';
import path from 'node:path';
const scope=process.argv[2];
const targets={
 live:{host:'jqtdgr-1y.myshopify.com',shop:'jillonlinestore.com',token:'JILL_LIVE_ADMIN_TOKEN'},
 work:{host:'jill-work.myshopify.com',shop:'jill-work.myshopify.com',token:'JILL_WORK_ADMIN_TOKEN'},
};
const target=targets[scope];
if(!target){console.error('Usage: node scripts/export-jill-safe-site-shell.mjs live|work');process.exit(2);}
const token=process.env[target.token];
if(!token){console.error('Missing '+target.token+'; no remote operation attempted.');process.exit(2);}
const query=`query SafeJillSiteShell {
 shop{myshopifyDomain}
 pages(first:50){nodes{handle title body templateSuffix publishedAt} pageInfo{hasNextPage}}
 menus(first:50){nodes{handle title items{title type url items{title type url}}} pageInfo{hasNextPage}}
}`;
try{
 const resp=await fetch('https://'+target.host+'/admin/api/2026-07/graphql.json',{
  method:'POST',headers:{'Content-Type':'application/json','X-Shopify-Access-Token':token},
  body:JSON.stringify({query}),signal:AbortSignal.timeout(30000)});
 if(!resp.ok)throw new Error('HTTP '+resp.status);
 const payload=await resp.json();
 if(payload.errors?.length)throw new Error('GraphQL query failed');
 const data=payload.data;
 if(data?.shop?.myshopifyDomain!==target.host)throw new Error('Wrong Shopify connection');
 if(data.pages.pageInfo.hasNextPage||data.menus.pageInfo.hasNextPage)
   throw new Error('Storefront pagination incomplete');
 const pages=data.pages.nodes.map(p=>({handle:p.handle,title:p.title,body:p.body,
   templateSuffix:p.templateSuffix,published:!!p.publishedAt}));
 const menus=data.menus.nodes.filter(m=>['main-menu','footer'].includes(m.handle))
   .map(m=>({handle:m.handle,title:m.title,
     items:m.items.map(i=>({title:i.title,type:i.type,url:i.url,
       items:i.items?.map(x=>({title:x.title,type:x.type,url:x.url}))||[]}))}));
 const output={schema:'jill.site-shell-safe.v1',shop:target.shop,
   readOnly:true,pages,menus,customerAccountMenuExcluded:true};
 const dir=path.join(process.cwd(),'.work-catalog-parity');
 fs.mkdirSync(dir,{recursive:true,mode:0o700});
 const dest=path.join(dir,scope+'.site-shell.json');
 fs.writeFileSync(dest+'.tmp',JSON.stringify(output,null,2)+'\n',{mode:0o600});
 fs.renameSync(dest+'.tmp',dest);
 console.log('Read-only '+scope.toUpperCase()+' site shell saved locally: '+
   pages.length+' pages, '+menus.length+' storefront menus.');
 console.log('Production account routes, customer data and secrets were not exported.');
}catch(e){console.error('Site-shell export stopped: '+e.message);process.exitCode=1;}
