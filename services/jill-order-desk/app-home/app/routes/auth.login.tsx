import {useLoaderData,Form,type LoaderFunctionArgs,type ActionFunctionArgs} from "react-router";
import {workShopify} from "../shopify.server";
const WORK_SHOP="jill-work.myshopify.com";
async function run(request:Request,env:Env) {
  const queryShop=new URL(request.url).searchParams.get("shop");
  const submittedShop=request.method==="POST"
    ? (await request.clone().formData()).get("shop") : null;
  // Never permit another store's OAuth installation via a crafted login form.
  if((queryShop && queryShop!==WORK_SHOP) ||
     (submittedShop && submittedShop!==WORK_SHOP))
    throw new Response("Unavailable",{status:403});
  return workShopify(env).login(request);
}
export async function loader({request,context}:LoaderFunctionArgs) {
  return {result:await run(request,context.cloudflare.env)};
}
export async function action({request,context}:ActionFunctionArgs) {
  return {result:await run(request,context.cloudflare.env)};
}
export default function Login() {
  useLoaderData<typeof loader>();
  return <main><h1>JILL WORK Order Desk</h1><p>Shopify Admin sign-in is required.</p>
    <Form method="post"><input type="hidden" name="shop" value={WORK_SHOP}/><button type="submit">Continue with Shopify</button></Form>
  </main>;
}
