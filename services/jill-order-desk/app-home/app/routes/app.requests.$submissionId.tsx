import {Link,useLoaderData,useParams,useRouteLoaderData,type LoaderFunctionArgs} from "react-router";
import {
  requestShortId,customerStatusLabel,internalStatusLabel,dateLabel,
} from "../../../inbox-display.mjs";
import "../styles/inbox.css";
import "../styles/request-detail.css";
import {WorkRequestQuickActions} from "../components/WorkRequestQuickActions";
import {WorkOriginalRequestDetails} from "../components/WorkOriginalRequestDetails";
import {WorkQuoteWorksheet} from "../components/WorkQuoteWorksheet";
import {loadAuthorizedWorkRequestDetail} from "./app.requests-detail-source.server";

export async function loader(args:LoaderFunctionArgs){
  return loadAuthorizedWorkRequestDetail(args);
}
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
// The authenticated parent loader is the single canonical source for both
// sibling pages. Direct URLs still run it and return 404 for unknown IDs;
// client-side navigation only selects from the previously authorized result.
function FulfillmentName({value}:{value:string}){
  return <>{value==="pickup"?"Local pickup":
    value==="shipping"?"Shipping":"Not provided"}</>;
}
export default function WorkRequestDetail(){
  const original=useLoaderData<typeof loader>();
  const data=useRouteLoaderData("routes/app.requests.layout") as InboxModel;
  const {submissionId}=useParams();
  const record=data.state==="ready"?
    data.records.find(item=>item.submission_id===submissionId)??null:null;
  const state=data.state==="ready"&&!record?"not_found":data.state;
  const controlsEnabled=data.controlsEnabled===true && state==="ready";
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
                      Status updates use canonical Google QA confirmation.
                      Detailed customer intake is loaded separately below.
                    </p>
                    <div className="jill-request__locked">
                      <span aria-hidden="true">◇</span>
                      A private quote worksheet is available below. Saving, customer approval, Shopify fulfillment and payments remain separate.
                    </div>
                  </section>
                </div>
              </div>
              <WorkOriginalRequestDetails model={original} submissionId={record.submission_id}/>
              <WorkQuoteWorksheet key={record.submission_id}
                model={original} submissionId={record.submission_id}
                customerStatus={record.customer_status}
                sourceRevision={record.revision}
                saveDraftEnabled={false}/>
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
