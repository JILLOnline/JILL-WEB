import {Link,useLoaderData,type LoaderFunctionArgs} from "react-router";
import {workShopify} from "../shopify.server";
import {loadWorkShopifyAdminRoute} from "../../../shopify-host/app-home-route.mjs";
import "../styles/hq-home.css";

const WORK_ADMIN="https://admin.shopify.com/store/jill-work";

export async function loader({request,context}:LoaderFunctionArgs) {
  const env=context.cloudflare.env;
  return loadWorkShopifyAdminRoute({
    request,authenticate:workShopify(env).authenticate,env,
  });
}

type HomeModel={state:string;description:string;role?:string};

export default function JillHQ() {
  const data=useLoaderData() as HomeModel;
  const verified=data.state==="staff_verified";
  const owner=verified && data.role==="owner";

  return <s-page inlineSize="large" heading="JILL HQ — WORK">
    <div className="jill-hq" role="region" aria-label="JILL HQ WORK merchant home">
      <header className="jill-hq__hero">
        <div className="jill-hq__hero-copy">
          <p className="jill-hq__eyebrow">JILL HQ <span aria-hidden="true">/</span> WORK</p>
          <h1>Everything starts with a clear next step.</h1>
          <p className="jill-hq__lead">Move custom requests through review and production. Keep products, customers, rewards and purchases connected to their Shopify source.</p>
          {owner ? <Link to="/app/requests" className="jill-hq__primary">
            Open verified WORK Custom Orders inbox <span aria-hidden="true">→</span>
          </Link> : null}
          {data.state==="merchant_setup_required"
            ? <Link to="/app/setup-owner" className="jill-hq__primary">WORK Owner commissioning <span aria-hidden="true">→</span></Link>
            : null}
        </div>
        <div className="jill-hq__hero-mark" aria-hidden="true">
          <span>JILL</span><span>HQ</span><small>WORKSPACE</small>
        </div>
      </header>

      <div className="jill-hq__status" role="status">
        <span className={`jill-hq__status-dot ${verified?"is-ready":""}`} aria-hidden="true"/>
        <div>
          <strong>{verified?"Merchant access verified":"Merchant access locked"}</strong>
          <p>{data.description}</p>
        </div>
        {verified ? <span className="jill-hq__environment">WORK ONLY</span> : null}
      </div>

      {owner?<p><Link to="/app/access">Owner access diagnostics</Link></p>:null}
      {verified ? <>
        <section className="jill-hq__section" aria-labelledby="hq-work-heading">
          <div className="jill-hq__section-heading">
            <div><p className="jill-hq__eyebrow">YOUR WORKSPACE</p><h2 id="hq-work-heading">Work from the right source</h2></div>
            <p>Each area opens the system that owns its data today.</p>
          </div>
          <div className="jill-hq__grid">
            <article className="jill-hq__card jill-hq__card--featured">
              <div className="jill-hq__card-top"><span className="jill-hq__card-number">01</span><span className="jill-hq__pill jill-hq__pill--ready">Owner workspace</span></div>
              <h3>Requests &amp; Operations</h3>
              <p>Open the original request, review personalization, update the permitted status and prepare its quote in one workspace.</p>
              {owner ? <Link to="/app/requests" className="jill-hq__card-link">Open Custom Orders <span aria-hidden="true">↗</span></Link>
                : <span className="jill-hq__card-note">Request access is assigned by the Owner.</span>}
            </article>
            <article className="jill-hq__card">
              <div className="jill-hq__card-top"><span className="jill-hq__card-number">02</span><span className="jill-hq__pill">Shopify source</span></div>
              <h3>Customers &amp; Loyalty</h3>
              <p>Use Shopify customer records now. The shared My JILL Rewards wallet and customer conversation are the next HQ connections.</p>
              <s-link href={`${WORK_ADMIN}/customers`}>Open Shopify customers ↗</s-link>
            </article>
            <article className="jill-hq__card">
              <div className="jill-hq__card-top"><span className="jill-hq__card-number">03</span><span className="jill-hq__pill">Shopify source</span></div>
              <h3>Store &amp; Commerce</h3>
              <p>Products, collections, checkout and orders stay in Shopify. HQ will add authorized views without copying prices or payments.</p>
              <div className="jill-hq__card-links">
                {owner?<Link to="/app/catalog" className="jill-hq__card-link">HQ catalog view →</Link>:null}
                <s-link href={`${WORK_ADMIN}/products`}>Products ↗</s-link>
                <s-link href={`${WORK_ADMIN}/collections`}>Collections ↗</s-link>
                <s-link href={`${WORK_ADMIN}/orders`}>Orders ↗</s-link>
              </div>
            </article>
            <article className="jill-hq__card">
              <div className="jill-hq__card-top"><span className="jill-hq__card-number">04</span><span className="jill-hq__pill">Owner governed</span></div>
              <h3>Team, Analytics &amp; Audit</h3>
              <p>Staff grants, source health and financial actions remain gated. The Owner reviews each connection before it becomes a control.</p>
              <span className="jill-hq__card-note">No unverified staff or financial action here.</span>
            </article>
          </div>
        </section>

        <section className="jill-hq__section jill-hq__journey" aria-labelledby="hq-journey-heading">
          <div className="jill-hq__section-heading">
            <div><p className="jill-hq__eyebrow">THE CONNECTED PATH</p><h2 id="hq-journey-heading">From request to purchase</h2></div>
            <p>One customer, one request history, one Shopify purchase.</p>
          </div>
          <ol className="jill-hq__steps">
            <li><span>01</span><strong>Request</strong><small>Original intake and merchant review</small></li>
            <li><span>02</span><strong>Conversation</strong><small>My JILL Inbox and HQ thread · planned</small></li>
            <li><span>03</span><strong>Approved quote</strong><small>Exact terms and Rewards calculation · planned</small></li>
            <li><span>04</span><strong>Shopify purchase</strong><small>Draft invoice, checkout and order · planned</small></li>
          </ol>
        </section>

        <div className="jill-hq__footnote">
          <strong>Rewards policy ready for WORK implementation</strong>
          <p>One point is worth $1 toward eligible merchandise, food, drinks or admissions. Every $1 reward needs $10 of eligible items. Current coupons retain their issued terms until the versioned wallet and checkout proof are complete.</p>
        </div>
      </> : <div className="jill-hq__locked">
        <h2>Access is being verified</h2>
        <p>Shopify staff identity and the JILL WORK merchant grant must both pass before business records appear here.</p>
      </div>}
    </div>
  </s-page>;
}
