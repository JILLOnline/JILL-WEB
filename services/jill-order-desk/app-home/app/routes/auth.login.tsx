import {
  useActionData,useLoaderData,Form,
  type LoaderFunctionArgs,type ActionFunctionArgs,
} from "react-router";
import {LoginErrorType,type LoginError} from "@shopify/shopify-app-react-router/server";
import {workShopify} from "../shopify.server";

const WORK_SHOP="jill-work.myshopify.com";

function loginErrorMessage(result:LoginError) {
  if(result?.shop===LoginErrorType.MissingShop)
    return {shop:"A WORK shop domain is required."};
  if(result?.shop===LoginErrorType.InvalidShop)
    return {shop:"The Shopify WORK shop domain is invalid."};
  return {};
}

async function run(request:Request,env:Env) {
  const url=new URL(request.url);
  const queryShops=url.searchParams.getAll("shop");
  const submittedShops=request.method==="POST"
    ? (await request.clone().formData()).getAll("shop"):[];

  // The only permitted identity is the existing WORK Shopify shop.
  // Never accept another shop, nor multiple values for the same identity.
  if(queryShops.length>1 || submittedShops.length>1 ||
    queryShops.some(shop=>shop!==WORK_SHOP) ||
    submittedShops.some(shop=>shop!==WORK_SHOP))
    throw new Response("Unavailable",{status:403});

  // Shopify owns the actual login, redirects and token exchange.
  // Do not serialize or wrap Response objects as loader data.
  const result=await workShopify(env).login(request);
  if(result instanceof Response)return result;
  return {errors:loginErrorMessage(result)};
}

export async function loader({request,context}:LoaderFunctionArgs) {
  return run(request,context.cloudflare.env);
}

export async function action({request,context}:ActionFunctionArgs) {
  return run(request,context.cloudflare.env);
}

export default function Login() {
  const loaded=useLoaderData<typeof loader>();
  const submitted=useActionData<typeof action>();
  const data=submitted||loaded;
  const errors=("errors" in data && data.errors)||{};
  return <main>
    <h1>JILL WORK Order Desk</h1>
    <p>Only the verified Shopify WORK shop can sign in.</p>
    <Form method="post">
      <input type="hidden" name="shop" value={WORK_SHOP}/>
      <button type="submit">Continue with Shopify</button>
    </Form>
    {"shop" in errors && errors.shop
      ? <p role="alert">{errors.shop}</p>:null}
  </main>;
}
