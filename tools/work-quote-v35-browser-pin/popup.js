// LOCAL ONLY: one tab, one hostname, fixed Cloudflare version ID.
// The browser, not this extension, retains Shopify authentication.
const RULE=351,ALARM="jill-work-v35-qa-expire";
const WORK="jill-order-desk-canary-work.jill-work-custom-orders.workers.dev";
const VERSION="dbc6341f-de7f-41de-8e97-6bf971201eeb";
const HEADER="Cloudflare-Workers-Version-Overrides";
const VALUE='jill-order-desk-canary-work="'+VERSION+'"';
const status=document.querySelector("#status");
const enable=document.querySelector("#enable");
const disable=document.querySelector("#disable");
function acceptedTab(raw){
  try{
    const u=new URL(raw||"");
    if(u.protocol!=="https:")return false;
    if(u.hostname===WORK)return true;
    if(u.hostname==="admin.shopify.com")
      return u.pathname.startsWith("/store/jill-work/");
    if(u.hostname==="jill-work.myshopify.com")
      return u.pathname.startsWith("/admin");
  }catch{}return false;
}
async function tab(){
  const arr=await chrome.tabs.query({active:true,currentWindow:true});
  if(arr.length!==1||!Number.isSafeInteger(arr[0].id))
    throw Error("Select one signed-in WORK tab.");
  return arr[0];
}
async function render(){
  const rules=await chrome.declarativeNetRequest.getSessionRules();
  const existing=rules.find(r=>r.id===RULE);
  const current=await tab();
  const active=!!existing&&existing.condition.tabIds?.includes(current.id);
  status.textContent=active?"ON · This tab uses v35":"OFF · Normal WORK v34 traffic";
  enable.disabled=!acceptedTab(current.url)||!!existing;
  disable.disabled=!existing;
}
enable.addEventListener("click",async()=>{
  try{
    const current=await tab();
    if(!acceptedTab(current.url))throw Error(
      "Open the JILL WORK Shopify Admin or WORK Worker tab first.");
    // tabIds is session-rule only. It cannot modify other tabs or hosts.
    const rule={
      id:RULE,priority:1,
      action:{type:"modifyHeaders",requestHeaders:[
        {header:HEADER,operation:"set",value:VALUE}
      ]},
      condition:{
        tabIds:[current.id],
        urlFilter:"|https://"+WORK+"/",
        resourceTypes:["main_frame","sub_frame","xmlhttprequest",
          "script","stylesheet","image","font","other","ping"]
      }
    };
    await chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds:[RULE],addRules:[rule]});
    await chrome.alarms.create(ALARM,{when:Date.now()+15*60*1000});
    status.textContent="ON · v35 pinned in this tab for 15 minutes. Refresh WORK app.";
  }catch(e){status.textContent="STOP: "+String(e?.message||"Browser QA not ready");}
  await render().catch(()=>{});
});
disable.addEventListener("click",async()=>{
  await chrome.declarativeNetRequest.updateSessionRules({removeRuleIds:[RULE]});
  await chrome.alarms.clear(ALARM);
  await render();
});
void render().catch(()=>{status.textContent="STOP: WORK browser tab unavailable.";});
