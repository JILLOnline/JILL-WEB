// No storage, no HTTP calls, no session/cookie inspection, no analytics.
const RULE=351;const ALARM="jill-work-v35-qa-expire";
async function clear(){await chrome.declarativeNetRequest.updateSessionRules({removeRuleIds:[RULE]});await chrome.alarms.clear(ALARM);}
chrome.alarms.onAlarm.addListener(a=>{if(a.name===ALARM)void clear();});
chrome.runtime.onStartup.addListener(()=>{void clear();});
chrome.runtime.onInstalled.addListener(()=>{void clear();});
chrome.tabs.onRemoved.addListener(async tabId=>{
  const rules=await chrome.declarativeNetRequest.getSessionRules();
  if(rules.some(r=>r.id===RULE&&r.condition.tabIds?.includes(tabId)))await clear();
});
