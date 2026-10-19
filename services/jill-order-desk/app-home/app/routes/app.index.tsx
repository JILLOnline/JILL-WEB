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

  return <s-page heading="JILL HQ — WORK" inlineSize="large">
    <div className="jill-hq" role="region" aria-label="JILL HQ WORK merchant home">
      <header className="jill-hq__hero">
        <div className="jill-hq__hero-copy">
          <p className="jill-hq__eyebrow">JILL HQ <span aria-hidden="true">/</span> WORK</p>
          <h1>Big ideas. Beautifully managed.</h1>
          <p className="jill-hq__lead">Your requests, your store, your next move.</p>
          {owner ? <Link to="/app/requests" className="jill-hq__primary">
            Open requests <span aria-hidden="true">→</span>
          </Link> : null}
          {data.state==="merchant_setup_required"
            ? <Link to="/app/setup-owner" className="jill-hq__primary">Set up Owner access <span aria-hidden="true">→</span></Link>
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
          {!verified?<p>{data.description}</p>:null}
        </div>
        {verified ? <span className="jill-hq__environment">WORK ONLY</span> : null}
      </div>


      {verified ? <>
        <section className="jill-hq__section" aria-labelledby="hq-work-heading">
          <div className="jill-hq__section-heading">
            <div><p className="jill-hq__eyebrow">MAKE SOMETHING GREAT</p><h2 id="hq-work-heading">Your workspace</h2></div>
          </div>
          <div className="jill-hq__grid">
            <article className="jill-hq__card jill-hq__card--featured">
              <div className="jill-hq__card-top"><span className="jill-hq__card-number">01</span><span className="jill-hq__pill jill-hq__pill--ready">HQ workspace</span></div>
              <h3>Custom requests</h3>
              <p>Review details. Keep things moving.</p>
              {owner ? <Link to="/app/requests" className="jill-hq__card-link">View requests <span aria-hidden="true">↗</span></Link>
                : <span className="jill-hq__card-note">Request access is assigned by the Owner.</span>}
            </article>
            <article className="jill-hq__card">
              <div className="jill-hq__card-top"><span className="jill-hq__card-number">02</span><span className="jill-hq__pill">Shopify source</span></div>
              <h3>Customers</h3>
              <p>Find your people in Shopify.</p>
              <a className="jill-button" href={`${WORK_ADMIN}/customers`} target="_top">Customers ↗</a>
            </article>
            <article className="jill-hq__card">
              <div className="jill-hq__card-top"><span className="jill-hq__card-number">03</span><span className="jill-hq__pill">Shopify source</span></div>
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
              <div className="jill-hq__card-top"><span className="jill-hq__card-number">04</span><span className="jill-hq__pill">Owner governed</span></div>
              <h3>Access &amp; permissions</h3>
              <p>Check your verified Shopify permissions.</p>
              {owner?<Link to="/app/access" className="jill-hq__card-link">View access →</Link>:<span className="jill-hq__card-note">Managed by your Owner.</span>}
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
