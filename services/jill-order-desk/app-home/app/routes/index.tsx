import {redirect,type LoaderFunctionArgs} from "react-router";
export async function loader({request}:LoaderFunctionArgs) {
  const url=new URL(request.url);
  // Keep Shopify's embedded app query (shop, host, etc.) for SDK validation.
  throw redirect("/app"+url.search);
}
export default function Index(){return null;}
