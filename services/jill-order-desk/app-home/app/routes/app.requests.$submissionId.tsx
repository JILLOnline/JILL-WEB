import {Link,useLoaderData,type LoaderFunctionArgs} from "react-router";
import {loader as inboxLoader} from "./app.requests";
import {
  requestShortId,customerStatusLabel,internalStatusLabel,dateLabel,
} from "../../../inbox-display.mjs";
import "../styles/inbox.css";
import "../styles/request-detail.css";
import {WorkRequestQuickActions} from "../components/WorkRequestQuickActions";
import "../styles/request-actions.css";

type RequestRecord={
  submission_id:string;
  revision:number;
  customer_status:string;
  internal_status:string;
  submitted_at:string;
  updated_at:string;
  date_needed:string;
  fulfillment:string;
  item_count:number;
};
type InboxModel={
  state:"ready"|"source_not_connected"|"source_unavailable"|"access_denied";
  readOnly:boolean;
  controlsEnabled?:boolean;
  records:RequestRecord[];
};
type DetailModel={
  state:InboxModel["state"]|"not_found";
  readOnly:true;
  record:RequestRecord|null;
  controlsEnabled:boolean;
};

/**
 * Do not create a second merchant auth or Google read path.
 * Reuse the existing, certified Shopify online Owner + WORK D1 permission
 * gate, bounded HMAC Google QA read, and whitelisted metadata projection.
 * Only the exact matching record is returned from this route; never expose
 * the full inbox or customer PII in the detail response.
 */
export async function loader(args:LoaderFunctionArgs){
  const inbox=await inboxLoader(args);
  const data=await inbox.json() as InboxModel;
  const headers=new Headers(inbox.headers);
  headers.set("cache-control","private, no-store, max-age=0");
  headers.set("x-content-type-options","nosniff");

  if(inbox.status!==200 || data.state!=="ready" || data.readOnly!==true){
    return Response.json({
      state:data.state,record:null,readOnly:true,controlsEnabled:false,
    } satisfies DetailModel,{status:inbox.status,headers});
  }
  // Exact match only, after authenticated source projection. No query IDs,
  // encoded wildcard matches, guessed missing fields or direct Google calls.
  const selected=data.records.find(
    item=>item.submission_id===args.params.submissionId);
  if(!selected){
    return Response.json({
      state:"not_found",record:null,readOnly:true,controlsEnabled:false,
    } satisfies DetailModel,{status:404,headers});
  }
  return Response.json({
    state:"ready",record:selected,readOnly:true,
    controlsEnabled:data.controlsEnabled===true,
  } satisfies DetailModel,{status:200,headers});
}

function FulfillmentName({value}:{value:string}){
  return <>{value==="pickup"?"Local pickup":
    value==="shipping"?"Shipping":"Not provided"}</>;
}
export default function WorkRequestDetail(){
  const {state,record,controlsEnabled}=useLoaderData<typeof loader>() as DetailModel;
  return <s-page heading="JILL HQ — WORK / Request details">
    <s-section>
      <main className="jill-inbox jill-request" aria-label="Custom Order request workspace">
        <nav className="jill-inbox__nav" aria-label="Request navigation">
          <Link className="jill-inbox__back" to="/app/requests">← Custom Orders inbox</Link>
          <span className="jill-inbox__readonly">WORK · {controlsEnabled?"MANAGEMENT":"READ ONLY"}</span>
        </nav>
        {state!=="ready" || !record
          ? <div className="jill-request__empty" role="status">
              <h2>{state==="not_found"?"Request not found":
                state==="source_unavailable"?"Source temporarily unavailable":
                state==="source_not_connected"?"Request source not connected":
                "Request access unavailable"}</h2>
              <p>No unverified request data or cached customer information is shown.</p>
              <Link to="/app/requests" className="jill-request__inline-link">Return to inbox →</Link>
            </div>
          : <>
              <header className="jill-request__header">
                <p className="jill-inbox__eyebrow">CUSTOM ORDER · VERIFIED WORK SOURCE</p>
                <div className="jill-request__heading">
                  <div>
                    <h2>Request #{requestShortId(record.submission_id)}</h2>
                    <p>Submitted {dateLabel(record.submitted_at,{includeTime:true})}</p>
                  </div>
                  <span className="jill-request__status">{customerStatusLabel(record.customer_status)}</span>
                </div>
              </header>
              <div className="jill-request__highlights">
                <div><span>Needed by</span><strong>{dateLabel(record.date_needed)}</strong></div>
                <div><span>Items</span><strong>{record.item_count}</strong></div>
                <div><span>Fulfillment</span><strong><FulfillmentName value={record.fulfillment}/></strong></div>
                <div><span>Internal stage</span><strong>{internalStatusLabel(record.internal_status)}</strong></div>
              </div>
              <div className="jill-request__grid">
                <section className="jill-request__panel" aria-labelledby="request-record">
                  <div className="jill-request__panel-head">
                    <h3 id="request-record">Request record</h3>
                    <span className="jill-request__source-tag">Source verified</span>
                  </div>
                  <dl className="jill-request__data">
                    <div><dt>Full request reference</dt><dd className="jill-inbox__ref">{record.submission_id}</dd></div>
                    <div><dt>Customer-facing status</dt><dd>{customerStatusLabel(record.customer_status)}</dd></div>
                    <div><dt>Internal workflow status</dt><dd>{internalStatusLabel(record.internal_status)}</dd></div>
                    <div><dt>Submitted</dt><dd>{dateLabel(record.submitted_at,{includeTime:true})}</dd></div>
                    <div><dt>Last updated</dt><dd>{dateLabel(record.updated_at,{includeTime:true})}</dd></div>
                    <div><dt>Source revision</dt><dd>{record.revision}</dd></div>
                  </dl>
                </section>
                <div className="jill-request__side">
                  <section className="jill-request__panel" aria-labelledby="request-activity">
                    <h3 id="request-activity">Source activity</h3>
                    <p className="jill-request__muted">
                      Latest verified snapshot — not a complete status history.
                    </p>
                    <div className="jill-request__activity">
                      <div><span className="jill-request__activity-marker"/>
                        <div><strong>Request submitted</strong>
                          <small>{dateLabel(record.submitted_at,{includeTime:true})}</small>
                        </div>
                      </div>
                      <div><span className="jill-request__activity-marker"/>
                        <div><strong>Last recorded update</strong>
                          <small>{dateLabel(record.updated_at,{includeTime:true})}</small>
                        </div>
                      </div>
                    </div>
                  </section>
                  <section className="jill-request__panel" aria-labelledby="request-next">
                    <h3 id="request-next">Request management</h3>
                    <WorkRequestQuickActions record={record} enabled={controlsEnabled}/>
                    <p className="jill-request__muted">
                      Full item customization, customer contact, attachments,
                      quotes and historical events need their own certified
                      merchant detail source. They are not available in this summary.
                    </p>
                    <div className="jill-request__locked">
                      <span aria-hidden="true">◇</span>
                      Quotes, Shopify fulfillment and payments remain separate.
                    </div>
                  </section>
                </div>
              </div>
            </>}
        <footer className="jill-inbox__footer">
          <strong>Verified WORK merchant view.</strong> The management tools save only after
          canonical Google QA confirmation. Shopify orders, payments and
          fulfillment remain separate.
        </footer>
      </main>
    </s-section>
  </s-page>;
}
