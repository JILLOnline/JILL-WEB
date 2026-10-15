import {AppProvider} from "@shopify/shopify-app-react-router/react";
import {boundary} from "@shopify/shopify-app-react-router/server";
import {Outlet,useLoaderData,useRouteError,type LoaderFunctionArgs,type HeadersFunction,type ShouldRevalidateFunctionArgs} from "react-router";
import {workShopify} from "../shopify.server";
import {JILL_WORK_MERCHANT_CLIENT_ID} from "../../../../../backend/jill-merchant-auth.mjs";
export async function loader({request,context}:LoaderFunctionArgs) {
  await workShopify(context.cloudflare.env).authenticate.admin(request);
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
    <Outlet/>
  </AppProvider>;
}
export function ErrorBoundary(){return boundary.error(useRouteError());}
export const headers:HeadersFunction=args=>boundary.headers(args);
