// Isolated WORK merchant Worker. Shopify Admin authentication is NOT
// configured; no merchant operation is accepted by this service.
// Public health must prove migrated D1 schema, without revealing owner/staff.
const headers={
  'Cache-Control':'private, no-store, max-age=0',
  'X-Content-Type-Options':'nosniff',
};
const ENVIRONMENT='JILL_ORDER_DESK_WORK';
const REQUIRED_TABLES=[
  'jill_merchant_audit',
  'jill_merchant_authority',
  'jill_merchant_grants',
];

async function verifySchema(db) {
  if(!db || typeof db.prepare!=='function')return false;
  try {
    const rowset=await db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' "+
      "AND name IN ('jill_merchant_audit','jill_merchant_authority',"+
      "'jill_merchant_grants') ORDER BY name"
    ).all();
    const actual=rowset?.results?.map(row=>row?.name);
    return Array.isArray(actual) &&
      actual.length===REQUIRED_TABLES.length &&
      actual.every((name,index)=>name===REQUIRED_TABLES[index]);
  } catch {
    return false;
  }
}

export default {
  async fetch(request,env) {
    const url=new URL(request.url);
    if(request.method==='GET' && url.pathname==='/healthz') {
      const dbReady=await verifySchema(env?.JILL_ORDER_DESK_WORK_DB);
      return Response.json({
        ok:dbReady,environment:ENVIRONMENT,
        database_ready:dbReady,admin_ready:false,
      },{status:dbReady?200:503,headers});
    }
    return Response.json({ok:false,error:'merchant_host_not_configured'},
      {status:503,headers});
  },
};
