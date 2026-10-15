// One authenticated, whitelisted canonical WORK Custom Orders snapshot for
// BOTH inbox and request workspace. Browser navigation reuses ONLY this
// in-memory React Router loader result, never a new backend authority.
// Direct URLs run this loader and recheck Shopify Owner + WORK D1.
import {Outlet,type LoaderFunctionArgs,type ShouldRevalidateFunctionArgs}
  from "react-router";
import {loader as loadVerifiedInbox} from "./app.requests";
import {mayReuseWorkRequestsSnapshot} from
  "../../../requests-navigation-policy.mjs";

export const REQUESTS_LAYOUT_ROUTE_ID="routes/app.requests.layout";
type VerifiedSnapshot={
  state?:string;
  records?:Array<{submission_id:string}>;
  verifiedAt?:number;
  readOnly?:boolean;
};

export function shouldRevalidate({
  currentUrl,nextUrl,formMethod,formAction,currentLoaderData,
  defaultShouldRevalidate,
}:ShouldRevalidateFunctionArgs){
  // An action (including a failed or unconfirmed write) or manual refresh
  // MUST retrieve the canonical source. A sibling Link navigation may only
  // reuse the verified in-memory projection for a short bounded interval.
  if(formMethod||formAction || currentUrl.pathname===nextUrl.pathname)
    return true;
  const reuse=mayReuseWorkRequestsSnapshot({
    currentUrl,nextUrl,formMethod,formAction,
    snapshot:currentLoaderData as VerifiedSnapshot|undefined,
  });
  return reuse?false:defaultShouldRevalidate;
}

export async function loader(args:LoaderFunctionArgs){
  // No shortcut: the existing inbox loader authenticates Shopify online
  // Owner, authorizes against WORK D1 and reads only the signed 9-field QA
  // projection. The same server path serves new/direct browser sessions.
  const response=await loadVerifiedInbox(args);
  const data=await response.json() as VerifiedSnapshot;
  const headers=new Headers(response.headers);
  headers.set("cache-control","private, no-store, max-age=0");
  headers.set("x-content-type-options","nosniff");

  // A directly opened unknown request MUST stay an HTTP 404 instead of a
  // UI-only missing state. Never expose the other inbox records on denial.
  if(args.params.submissionId && response.status===200 &&
     data.state==="ready" &&
     !data.records?.some(item=>
       item.submission_id===args.params.submissionId)){
    throw new Response("Not found",{
      status:404,headers:{"cache-control":"private, no-store, max-age=0",
        "x-content-type-options":"nosniff"},
    });
  }
  return Response.json({...data,verifiedAt:Date.now()},{
    status:response.status,headers,
  });
}
export default function VerifiedRequestsLayout(){return <Outlet/>;}
