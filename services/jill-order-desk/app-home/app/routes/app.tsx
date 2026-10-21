import {AppProvider} from "@shopify/shopify-app-react-router/react";
import {boundary} from "@shopify/shopify-app-react-router/server";
import {NavLink,Outlet,useLoaderData,useRouteError,type LoaderFunctionArgs,type HeadersFunction,type ShouldRevalidateFunctionArgs} from "react-router";
import {workShopify} from "../shopify.server";
import {authenticateWorkAdminOnce} from "../../../work-admin-auth-once.mjs";
import {JILL_WORK_MERCHANT_CLIENT_ID} from "../../../../../backend/jill-merchant-auth.mjs";
import "../styles/hq-theme.css";
export async function loader({request,context}:LoaderFunctionArgs) {
  await authenticateWorkAdminOnce({
    scope:context.cloudflare,
    authenticate:()=>workShopify(context.cloudflare.env).authenticate.admin(request),
  });
  return {apiKey:JILL_WORK_MERCHANT_CLIENT_ID};
}
// Once the WORK request layout authenticated Owner and D1, sibling
// navigation only reuses its short-lived whitelisted in-memory snapshot.
// Never skip an actual write, refresh or navigation outside this module.
// Direct visits and request-layout refreshes still authenticate server-side.
export function shouldRevalidate({
  currentUrl,nextUrl,formMethod,formAction,defaultShouldRevalidate,
}:ShouldRevalidateFunctionArgs){
  if(!formMethod && !formAction &&
     currentUrl.pathname!==nextUrl.pathname &&
     /^\/app\/requests(?:\/|$)/.test(currentUrl.pathname) &&
     /^\/app\/requests(?:\/|$)/.test(nextUrl.pathname) &&
     !currentUrl.search && !nextUrl.search)
    return false;
  return defaultShouldRevalidate;
}
export default function App(){
  const {apiKey}=useLoaderData<typeof loader>();
  return <AppProvider apiKey={apiKey}>
    <div className="jill-workspace">
      <nav className="jill-workspace__navigation" aria-label="JILL HQ navigation">
        <span className="jill-workspace__brand" aria-label="JILL HQ">JILL<span>HQ</span></span>
        <div className="jill-workspace__navigation-items">
          <NavLink to="/app" end>Home</NavLink>
          <NavLink to="/app/requests">Requests</NavLink>
          <NavLink to="/app/queue">Work Queue</NavLink>
          <NavLink to="/app/messages">Messages</NavLink>
          <NavLink to="/app/catalog">Catalog</NavLink>
          <NavLink to="/app/access">Access</NavLink>
        </div>
        <span className="jill-workspace__work">WORK</span>
      </nav>
      <Outlet/>
    </div>
  </AppProvider>;
}
export function ErrorBoundary(){return boundary.error(useRouteError());}
export const headers:HeadersFunction=args=>boundary.headers(args);
