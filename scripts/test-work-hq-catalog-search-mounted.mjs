// Real Catalog route and memory router with a synthetic read-only loader.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {writeFileSync,rmSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const app=new URL('../services/jill-order-desk/app-home/',import.meta.url);
const require=createRequire(new URL('package.json',app));
const {build}=require('esbuild'),React=require('react');
const {act}=React,{createRoot}=require('react-dom/client');
const {createMemoryRouter,RouterProvider}=require('react-router');
const {parseHTML}=createRequire(new URL('../tools/work-account-local/package.json',import.meta.url))('linkedom');
const {document,window}=parseHTML('<html><body><div id="root"></div></body></html>');
Object.assign(globalThis,{document,window,HTMLElement:window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true});

const file=new URL('.catalog-mounted-'+randomUUID()+'.mjs',app);
const input=()=>document.querySelector('input[name=q]');
const params=router=>new URLSearchParams(router.state.location.search);
const click=label=>act(async()=>{
  const link=[...document.querySelectorAll('a')].find(node=>node.textContent===label);
  assert.ok(link,'Expected link: '+label);
  const event=new window.Event('click',{bubbles:true,cancelable:true});
  Object.defineProperty(event,'button',{value:0});
  link.dispatchEvent(event);
});

let root,router;
try{
  const built=await build({
    entryPoints:[fileURLToPath(new URL('app/routes/app.catalog.tsx',app))],
    bundle:true,write:false,platform:'node',format:'esm',jsx:'automatic',
    external:['react','react/jsx-runtime','react-router'],
    plugins:[{name:'synthetic-catalog-loader',setup(b){
      b.onResolve({filter:/shopify\.server$/},()=>({path:'shopify',namespace:'stub'}));
      b.onLoad({filter:/.*/,namespace:'stub'},()=>({contents:
        'export function workShopify(){throw Error("Real Shopify access is forbidden");}'}));
      b.onLoad({filter:/\.css$/},()=>({contents:'',loader:'js'}));
    }}],
  });
  writeFileSync(file,built.outputFiles[0].text,{flag:'wx'});
  const {default:Catalog}=await import(file.href);
  router=createMemoryRouter([{
    path:'/app/catalog',Component:Catalog,HydrateFallback:()=>null,
    loader:({request})=>{
      const search=new URL(request.url).searchParams.get('q')||'';
      if(search==='x')return {state:'invalid_request'};
      return {state:'ready',view:'products',search,currency:'USD',
        next_cursor:'CATALOG_NEXT',records:[{
          id:'synthetic-1',title:search?'Synthetic Tote':'Unfiltered Product',
          status:'ACTIVE',admin_url:'https://example.invalid/product',total_inventory:0,
        }]};
    },
  }],{initialEntries:['/app/catalog?view=products&q=tote']});
  await act(async()=>{
    root=createRoot(document.getElementById('root'));
    root.render(React.createElement(RouterProvider,{router}));
  });
  assert.equal(input().value,'tote');
  await click('Next Shopify page →');
  assert.equal(params(router).get('q'),'tote');
  assert.equal(params(router).get('after'),'CATALOG_NEXT');
  assert.equal(input().value,'tote');

  await click('Clear');
  assert.equal(params(router).has('q'),false);
  assert.equal(params(router).has('after'),false);
  assert.match(document.body.textContent,/Unfiltered Product/);
  assert.equal(input().value,'','Clear resets the applied search textbox');

  input().value='unsent title';
  await click('Clear');
  assert.equal(params(router).has('q'),false);
  assert.equal(input().value,'','Clear resets unsent text on the unfiltered URL');

  await act(async()=>{await router.navigate('/app/catalog?view=products&q=x');});
  assert.match(document.body.textContent,/Search is invalid/);
  assert.equal(input().value,'x','An invalid search remains editable');
  console.log('PASS mounted HQ Catalog: Clear resets applied and unsent search, pagination retains q, and invalid search remains editable.');
}finally{
  if(root)await act(async()=>root.unmount());
  router?.dispose();
  rmSync(file,{force:true});
}
