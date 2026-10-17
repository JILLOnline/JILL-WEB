import {boundary} from "@shopify/shopify-app-react-router/server";
import {workShopify} from "../shopify.server";
import {type LoaderFunctionArgs,type HeadersFunction} from "react-router";
export async function loader({request,context}:LoaderFunctionArgs) {
  await workShopify(context.cloudflare.env).authenticate.admin(request);
  return null;
}
export const headers:HeadersFunction=args=>boundary.headers(args);
