// Presentation ONLY: already verified Owner-scoped exact request data.
// Legacy submissions may include Cloudinary public delivery URLs where
// reference IDs are expected. Never trust, open or embed them as media.
import {describeWorkReference} from "../../../work-reference-provenance.mjs";
import {JillChevronDown} from "./JillChevronDown";
type Attribute={id:string;label:string;value:string|number|boolean|
  Array<string|number|boolean>};
type OriginalItem={
  item_id:string;product_id:string;variant_id:string;title:string;
  quantity:number;collection_ids:string[];reference_ids:string[];
  attributes:Attribute[];
  variant_allocations:Array<{variant_id:string;title:string;
    quantity:number;unit_ids:string[]}>;
  personalization_groups:Array<{id:string;
    allocations:Array<{unit_id:string}>;attributes:Attribute[]}>;
};
type Detail={
  submission_id:string;revision:number;submitted_at:string;
  customer:{name:string;email:string;phone:string;preferred_contact:string};
  planning:{date_needed:string;fulfillment:string;
    address:{city:string;state:string;postal_code:string;country_code:string};
    attributes:Attribute[]};
  items:OriginalItem[];request_attributes:Attribute[];
  reference_ids:string[];attachment_state:"unresolved";
};
type Model={
  state:"ready"|"not_connected"|"source_unavailable"|"access_denied"|"not_found";
  detail?:Detail|null;
};
function attributeValue(value:Attribute["value"]){
  if(Array.isArray(value))return value.map(String).join(", ");
  if(typeof value==="boolean")return value?"Yes":"No";
  return String(value);
}
function Attributes({values}:{values:Attribute[]}){
  if(!values?.length)return <p className="jill-request__muted">No additional options supplied.</p>;
  return <dl className="jill-request__data">
    {values.map((entry,i)=><div key={entry.id+"-"+i}>
      <dt>{entry.label||entry.id.replaceAll("_"," ")}</dt>
      <dd>{attributeValue(entry.value)}</dd>
    </div>)}
  </dl>;
}
function OpaqueReferences({ids,label}:{ids:string[];label:string}){
  if(!ids?.length)return null;
  return <div className="jill-request__file-manifest">
    <strong>{label} ({ids.length})</strong>
    <ul>{ids.map((id,i)=>{
      const ref=describeWorkReference(id);
      return <li key={i}>
        <span className="jill-request__file-icon" aria-hidden="true">◇</span>
        <span>{ref.label} {i+1}: <code>{ref.identifier}</code></span>
      </li>;
    })}</ul>
    <p className="jill-request__muted">Secure previews and downloads are unavailable. File references do not verify ownership.</p>
  </div>;
}
function verifiedDetails(model:Model|undefined,submissionId:string){
  return model?.state==="ready" && model.detail?.submission_id===submissionId
    ?model.detail:null;
}
function RequestDetailsUnavailable({model}:{model:Model|undefined}){
  return <p className="jill-request__muted" role="status">
    {model?.state==="not_connected"
      ?"Full request details are awaiting the signed WORK QA detail connection. The original submission is preserved."
      :model?.state==="access_denied"
        ?"Owner authorization is required to view original customer details."
        :model?.state==="not_found"
          ?"Original request not found."
          :"Full request details are temporarily unavailable. No unverified information is shown."}
  </p>;
}
export function WorkOrderDetailsContent({model,submissionId,stacked=false}:{model:Model|undefined;submissionId:string;stacked?:boolean}){
  const details=verifiedDetails(model,submissionId);
  return !details?<RequestDetailsUnavailable model={model}/>:<>
      <div className={"jill-request__full-overview"+(stacked?" jill-request__full-overview--stacked":"")}>
        <div>
          <h4>Customer & event</h4>
          <dl className="jill-request__data">
            <div><dt>Customer</dt><dd>{details.customer.name}</dd></div>
            {details.customer.phone?<div><dt>Phone</dt><dd>{details.customer.phone}</dd></div>:null}
            <div><dt>Preferred contact</dt><dd>{details.customer.preferred_contact}</dd></div>
            <div><dt>Needed by</dt><dd>{details.planning.date_needed||"Not provided"}</dd></div>
            <div><dt>Fulfillment</dt><dd>{details.planning.fulfillment||"Not provided"}</dd></div>
            {details.planning.address.city||details.planning.address.postal_code
              ?<div><dt>Destination</dt><dd>
                {[details.planning.address.city,details.planning.address.state,
                  details.planning.address.postal_code,
                  details.planning.address.country_code].filter(Boolean).join(", ")}
              </dd></div>:null}
          </dl>
        </div>
        <div>
          <h4>Special instructions</h4>
          <Attributes values={[...details.planning.attributes,
            ...details.request_attributes].filter(attribute=>attribute.id!=="order_type")}/>
        </div>
      </div>
      {stacked&&<div className="jill-request__original-items"
        aria-label="Verified requested items and personalization">
        <h4>Requested items ({details.items.length})</h4>
        {details.items.map((item,i)=>
          <article key={item.item_id} className="jill-request__original-item">
            <div className="jill-request__item-header">
              <div>
                <small>Item {i+1}</small>
                <h4>{item.title||"Custom item"}</h4>
              </div>
              <strong className="jill-request__item-quantity">
                Qty {item.quantity}
              </strong>
            </div>
            {item.variant_allocations.length>0&&
              <div className="jill-request__original-subsection">
                <strong>Selected variations</strong>
                {item.variant_allocations.map((variant,j)=>
                  <p key={variant.variant_id+"-"+j}>
                    {variant.title||"Selected variation"} · Qty {variant.quantity}
                  </p>)}
              </div>}
            {item.attributes.length>0&&
              <details className="jill-request__references">
                <summary>Item options ({item.attributes.length})</summary>
                <Attributes values={item.attributes}/>
              </details>}
            {item.personalization_groups.length>0&&
              <details className="jill-request__references">
                <summary>Per-unit personalization ({item.personalization_groups.length})</summary>
                <div className="jill-request__personalization-grid">
                  {item.personalization_groups.map((group,j)=>
                    <section key={group.id+"-"+j}
                      className="jill-request__personalization">
                      <strong>{group.id}</strong>
                      <Attributes values={group.attributes}/>
                    </section>)}
                </div>
              </details>}
            {item.reference_ids.length>0&&
              <p className="jill-request__muted">
                {item.reference_ids.length} artwork reference(s) recorded.
                Secure previews are not available here.
              </p>}
          </article>)}
      </div>}
    </>;
}
export function WorkOrderDetails({model,submissionId}:{model:Model|undefined;submissionId:string}){
  // Always visible in the full request workspace, unlike its inbox preview.
  return <section className="jill-request__panel jill-workspace__overview"
    aria-labelledby="jill-request-order-details-title">
    <h3 id="jill-request-order-details-title">Order details</h3>
    <WorkOrderDetailsContent model={model} submissionId={submissionId}/>
  </section>;
}
export function WorkOriginalRequestDetails({model,submissionId}:{
  model:Model|undefined;submissionId:string;
}){
  const details=verifiedDetails(model,submissionId);
  return <details className="jill-request__panel jill-request__full jill-request__fold"
    aria-label="Items and personalization">
    <summary className="jill-request__fold-head">
      <span className="jill-request__fold-title">Items & personalization</span>
      {details?<span className="jill-request__source-tag">Verified revision {details.revision}</span>:null}
      <span className="jill-request__fold-chevron jill-ui__end-chevron" aria-hidden="true"><JillChevronDown/></span>
    </summary>
    <div className="jill-request__fold-body">
    {!details?
      <RequestDetailsUnavailable model={model}/>:
    <>
      <div className="jill-request__original-items">
        {details.items.map((item,i)=><article key={item.item_id} className="jill-request__original-item">
          <div className="jill-request__item-header">
            <div>
              <span className="jill-inbox__eyebrow">Item {i+1}</span>
              <h4>{item.title||"Custom item"}</h4>
              <details className="jill-request__references"><summary>Product references<span className="jill-ui__end-chevron"><JillChevronDown/></span></summary>
                <p>Item: {item.item_id}</p>
                <p>Product: {item.product_id}{item.variant_id?" · Variant: "+item.variant_id:""}</p>
              </details>
            </div>
            <strong className="jill-request__item-quantity">Qty {item.quantity}</strong>
          </div>
          <h5>Item options</h5>
          <Attributes values={item.attributes}/>
          {item.variant_allocations.length?<div className="jill-request__original-subsection">
            <h5>Selected variations</h5>
            {item.variant_allocations.map((v,i)=><p key={v.variant_id+"-"+i}>
              {v.title||v.variant_id} · Qty {v.quantity} · Units: {v.unit_ids.join(", ")}
            </p>)}
          </div>:null}
          {item.personalization_groups.length?<div className="jill-request__original-subsection">
            <h5>Per-unit personalization</h5>
            <div className="jill-request__personalization-grid">
              {item.personalization_groups.map((g,i)=><section key={g.id+"-"+i}
                className="jill-request__personalization">
                <strong>{g.id}</strong>
                <small>Units: {g.allocations.map(a=>a.unit_id).join(", ")}</small>
                <Attributes values={g.attributes}/>
              </section>)}
            </div>
          </div>:null}
          <OpaqueReferences ids={item.reference_ids} label="Item references"/>
        </article>)}
      </div>
      <OpaqueReferences ids={details.reference_ids} label="Request-level references"/>
    </>}
    </div>
  </details>;
}
