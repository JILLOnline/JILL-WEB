import {AppProvider} from "@shopify/shopify-app-react-router/react";
import {boundary} from "@shopify/shopify-app-react-router/server";
import {Outlet,useLoaderData,useRouteError,type LoaderFunctionArgs,type HeadersFunction} from "react-router";
import {workShopify} from "../shopify.server";
import {JILL_WORK_MERCHANT_CLIENT_ID} from "../../../../../backend/jill-merchant-auth.mjs";
export async function loader({request,context}:LoaderFunctionArgs) {
  await workShopify(context.cloudflare.env).authenticate.admin(request);
  return {apiKey:JILL_WORK_MERCHANT_CLIENT_ID};
}
export default function App(){
  const {apiKey}=useLoaderData<typeof loader>();
  return <AppProvider embedded apiKey={apiKey}>
    <s-app-nav><s-link href="/app">Order Desk</s-link></s-app-nav>
    <Outlet/>
  </AppProvider>;
}
export function ErrorBoundary(){return boundary.error(useRouteError());}
export const headers:HeadersFunction=args=>boundary.headers(args);
