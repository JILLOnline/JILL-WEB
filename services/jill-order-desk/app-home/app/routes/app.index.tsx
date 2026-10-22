import {Suspense} from "react";
import {Link,Await,data as routeData,useLoaderData,type LoaderFunctionArgs} from "react-router";
import {workShopify} from "../shopify.server";
import {loadWorkShopifyAdminRoute} from "../../../shopify-host/app-home-route.mjs";
import {authenticateWorkAdminOnce} from "../../../work-admin-auth-once.mjs";
import {loadVerifiedMerchantInbox} from "./app.requests-source.server";
import {inboxStats} from "../../../inbox-display.mjs";
import "../styles/hq-home.css";

const WORK_ADMIN="https://admin.shopify.com/store/jill-work";

type RequestSummary={state:string;stats?:{total:number;reviewing:number;needsQuote:number}};
type HomeModel={state:string;description:string;role?:string;requestSummary:Promise<RequestSummary|null>};
export async function loader(args:LoaderFunctionArgs) {
  const {request,context}=args,env=context.cloudflare.env;
  const response=await loadWorkShopifyAdminRoute({
    request,authenticate:{admin:()=>authenticateWorkAdminOnce({
      scope:context.cloudflare,authenticate:()=>workShopify(env).authenticate.admin(request),
    })},env,
  });
  const home=await response.json() as Omit<HomeModel,"requestSummary">;
  // Stream counts after the authorized shell. Reuse the canonical Owner-only
  // inbox projection and cache; never copy customer records into Home data.
  const requestSummary=home.state==="staff_verified"&&home.role==="owner"
    ? (async()=>{
        const result=await loadVerifiedMerchantInbox(args);
        const model=await result.json() as {state:string;records:unknown[]};
        return model.state==="ready"?{state:model.state,stats:inboxStats(model.records)}:{state:model.state};
      })()
    : Promise.resolve(null);
  return routeData({...home,requestSummary},{status:response.status,headers:response.headers});
}
function RequestOverview({summary}:{summary:RequestSummary|null}){
  if(summary?.state!=="ready"||!summary.stats)return <p className="jill-hq__summary-state" role="status">Request counts are temporarily unavailable.</p>;
  return <div className="jill-hq__metrics" aria-label="Request overview">
    <div><span>Requests</span><strong>{summary.stats.total}</strong></div>
    <div><span>In review</span><strong>{summary.stats.reviewing}</strong></div>
    <div><span>Needs a quote</span><strong>{summary.stats.needsQuote}</strong></div>
  </div>;
}

export default function JillHQ() {
  const data=useLoaderData() as HomeModel;
  const verified=data.state==="staff_verified";
  const owner=verified && data.role==="owner";

  return <s-page heading="JILL HQ — WORK" inlineSize="large">
    <div className="jill-hq" role="region" aria-label="JILL HQ WORK merchant home">
      {data.state==="merchant_setup_required"
        ? <Link to="/app/setup-owner" className="jill-button">Set up Owner access <span aria-hidden="true">→</span></Link>
        : null}

      <div className="jill-hq__status" role="status">
        <span className={`jill-hq__status-dot ${verified?"is-ready":""}`} aria-hidden="true"/>
        <div>
          <strong>{verified?"Merchant access verified":"Merchant access locked"}</strong>
          {!verified?<p>{data.description}</p>:null}
        </div>
        {verified ? <span className="jill-hq__environment">WORK ONLY</span> : null}
      </div>


      {owner?<section className="jill-hq__section" aria-labelledby="hq-overview-heading">
        <div className="jill-hq__section-heading"><h2 id="hq-overview-heading">Request overview</h2><Link to="/app/requests" className="jill-hq__card-link">View requests →</Link></div>
        <Suspense fallback={<p className="jill-hq__summary-state" role="status">Loading request counts…</p>}>
          <Await resolve={data.requestSummary} errorElement={<p className="jill-hq__summary-state" role="status">Request counts are temporarily unavailable.</p>}>
            {summary=><RequestOverview summary={summary}/>}
          </Await>
        </Suspense>
      </section>:null}
      {verified ? <>
        <section className="jill-hq__section" aria-labelledby="hq-work-heading">
          <div className="jill-hq__section-heading">
            <div><p className="jill-hq__eyebrow">MAKE SOMETHING GREAT</p><h2 id="hq-work-heading">Store shortcuts</h2></div>
          </div>
          <div className="jill-hq__grid">
            <article className="jill-hq__card">
              <div className="jill-hq__card-top"><span className="jill-hq__card-number">01</span><span className="jill-hq__pill">Shopify source</span></div>
              <h3>Customers</h3>
              <p>Find your people in Shopify.</p>
              <a className="jill-button" href={`${WORK_ADMIN}/customers`} target="_top">Customers ↗</a>
            </article>
            <article className="jill-hq__card">
              <div className="jill-hq__card-top"><span className="jill-hq__card-number">02</span><span className="jill-hq__pill">Shopify source</span></div>
              <h3>Your store</h3>
              <p>Browse your catalog or jump into Shopify.</p>
              <div className="jill-hq__card-links">
                {owner?<Link to="/app/catalog" className="jill-hq__card-link">Browse catalog →</Link>:null}
                <a className="jill-button jill-button--quiet" href={`${WORK_ADMIN}/products`} target="_top">Products ↗</a>
                <a className="jill-button jill-button--quiet" href={`${WORK_ADMIN}/collections`} target="_top">Collections ↗</a>
                <a className="jill-button jill-button--quiet" href={`${WORK_ADMIN}/orders`} target="_top">Orders ↗</a>
              </div>
            </article>
            <article className="jill-hq__card">
              <div className="jill-hq__card-top"><span className="jill-hq__card-number">03</span><span className="jill-hq__pill">Owner governed</span></div>
              <h3>Settings</h3>
              <p>Review Owner access and permissions.</p>
              {owner?<Link to="/app/access" className="jill-hq__card-link">Open settings →</Link>:<span className="jill-hq__card-note">Managed by your Owner.</span>}
            </article>
          </div>
        </section>

      </> : <div className="jill-hq__locked">
        <h2>Access is being verified</h2>
        <p>Shopify staff identity and the JILL WORK merchant grant must both pass before business records appear here.</p>
      </div>}
    </div>
  </s-page>;
}
