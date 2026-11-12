const screens={
  "hq-home":{label:"HQ Home",styles:["hq-home.css"],kind:"hq"},
  "hq-requests":{label:"HQ Requests",styles:["inbox.css","request-actions.css"],kind:"hq"},
  "hq-request-detail":{label:"HQ Request details",styles:["inbox.css","request-detail.css","request-actions.css"],kind:"hq"},
  "hq-messages":{label:"HQ Messages",styles:["hq-messages.css","request-actions.css"],kind:"hq"},
  "hq-contact-us":{label:"HQ Contact Us",styles:["inbox.css"],kind:"hq"},
  "hq-catalog":{label:"HQ Catalog",styles:["inbox.css","request-detail.css","hq-catalog.css"],kind:"hq"},
  "hq-settings":{label:"HQ Settings",styles:["inbox.css"],kind:"hq"},
  "myjill-overview":{label:"My JILL Overview",kind:"myjill"},
  "myjill-custom-orders":{label:"My JILL Custom Orders",kind:"myjill"},
  "myjill-messages":{label:"My JILL Messages",kind:"myjill"},
  "myjill-rewards":{label:"My JILL Rewards",kind:"myjill"},
  "myjill-coupons":{label:"My JILL Coupons",kind:"myjill"},
};
const hqNav=[["Home","hq-home"],["Requests","hq-requests"],["Messages","hq-messages"],
  ["Contact Us","hq-contact-us"],["Catalog","hq-catalog"],["Settings","hq-settings"]];
const myJillNav=[["Overview","myjill-overview",true],["Rewards","myjill-rewards",true],
  ["Coupons","myjill-coupons",true],["Custom Orders","myjill-custom-orders",true],
  ["Messages","myjill-messages",true],["Celebrations","",false],
  ["Saved for You","",false],["JILL Settings","",false]];
const details=`<div class="jill-inbox__order-details"><div class="jill-inbox__details-heading">
  <strong>Original Custom Order · SYNTHETIC FIXTURE</strong><span>Revision 2</span></div>
  <div class="fixture-columns"><div><strong>Items &amp; Personalization</strong>
  <p>Celebration topper · quantity 1 · fictional color and wording choices.</p>
  <p>Requested date is not a production or delivery promise.</p></div>
  <div><strong>Source status</strong><p>Verified synthetic sample only; no source lookup.</p>
  <button class="fixture-disabled" disabled>Update Status — preview only</button></div></div></div>`;
const layouts={
  "hq-home":()=>`<s-page heading="JILL HQ — WORK" inlineSize="large"><div class="jill-hq">
    <div class="jill-hq__status"><span class="jill-hq__status-dot is-ready"></span>
      <div><strong>Synthetic access state</strong><p>Fixture only; no Shopify session is present.</p></div>
      <span class="jill-hq__environment">SYNTHETIC</span></div>
    <section class="jill-hq__section"><div class="jill-hq__section-heading"><h2>Request overview</h2></div>
      <div class="jill-hq__metrics"><div><span>Requests</span><strong>4</strong></div>
      <div><span>In review</span><strong>1</strong></div><div><span>Needs a quote</span><strong>1</strong></div>
      <section class="jill-hq__priority"><h3>Next actions</h3><ul class="jill-hq__priority-list">
        <li><strong>1</strong><span>New requests</span></li><li><strong>1</strong><span>Requested dates passed</span></li>
        <li><strong>1</strong><span>Dates approaching</span></li></ul>
        <p class="jill-hq__source-note">Use Requests in the shared navigation to review details. Dates are not delivery promises.</p>
      </section></div></section>
    <section class="jill-hq__section"><div class="jill-hq__section-heading"><h2>Store shortcuts</h2></div>
      <div class="jill-hq__grid"><article class="jill-hq__card"><div class="jill-hq__card-top"><span class="jill-hq__card-number">01</span><span class="jill-hq__pill">Shopify source</span></div><h3>Customers</h3><p>Find your people in Shopify.</p><button class="jill-hq__card-link fixture-disabled" disabled>Disabled in fixture</button></article>
      <article class="jill-hq__card"><div class="jill-hq__card-top"><span class="jill-hq__card-number">02</span><span class="jill-hq__pill">Shopify source</span></div><h3>Your store</h3><p>Browse your catalog or jump into Shopify.</p><button class="jill-hq__card-link fixture-disabled" disabled>Catalog preview only</button></article>
      <article class="jill-hq__card"><div class="jill-hq__card-top"><span class="jill-hq__card-number">03</span><span class="jill-hq__pill">Owner governed</span></div><h3>Settings</h3><p>Access and permissions remain source-gated.</p><button class="jill-hq__card-link fixture-disabled" disabled>Settings preview only</button></article></div></section>
    </div></s-page>`,
  "hq-requests":()=>`<s-page heading="JILL HQ — WORK / Custom Orders" inlineSize="large"><main class="jill-inbox">
    <div class="jill-inbox__nav"><span class="jill-inbox__back">← Home</span><span class="jill-inbox__access-badge">SYNTHETIC FIXTURE</span></div>
    <header class="jill-inbox__intro"><h2>REQUESTS</h2></header>
    <p class="fixture-message">Four fictional request summaries; no customer details or source connection.</p>
    <div class="jill-inbox__stats"><div class="jill-inbox__metric"><span>Active requests</span><strong>4</strong></div>
      <div class="jill-inbox__metric"><span>Archived</span><strong>0</strong></div><div class="jill-inbox__metric"><span>In review</span><strong>1</strong></div><div class="jill-inbox__metric"><span>Needs a quote</span><strong>1</strong></div></div>
    <div class="jill-inbox__toolbar"><label class="jill-inbox__search">Find request<input class="fixture-field" placeholder="Synthetic request ID"></label>
      <label>Request status<select class="fixture-field"><option>All statuses</option></select></label><label>Sort requests<select class="fixture-field"><option>Recently updated</option></select></label></div>
    <div class="jill-inbox__results-head"><h3>Active requests</h3><p>4 fictional records</p></div>
    <div class="jill-inbox__table"><div class="jill-inbox__columns"><span>Customer</span><span>Request</span><span>Status</span><span>Stage</span><span>Needed by</span><span>Submitted</span><span>Actions</span><span></span></div>
      <article class="jill-inbox__card jill-inbox__card--reviewing"><div class="jill-inbox__row">
        <button class="jill-inbox__row-trigger" aria-expanded="true"><span class="jill-inbox__cell jill-inbox__cell--customer"><span class="jill-inbox__customer-name">Sample Person · SYNTHETIC</span></span>
        <span class="jill-inbox__cell jill-inbox__cell--request"><span class="jill-inbox__request-id">#SYNTH-1042</span></span>
        <span class="jill-inbox__cell jill-inbox__cell--status"><span class="jill-inbox__status jill-inbox__status--reviewing">In review</span></span>
        <span class="jill-inbox__cell jill-inbox__cell--stage"><span class="jill-inbox__internal">Needs quote</span></span>
        <span class="jill-inbox__cell jill-inbox__cell--needed" data-label="Needed by">Nov 14, 2026</span>
        <span class="jill-inbox__cell jill-inbox__cell--submitted" data-label="Submitted">Nov 8, 2026</span></button>
        <div class="jill-inbox__cell jill-inbox__cell--actions"><button class="fixture-disabled" disabled>Message Customer</button><button class="fixture-disabled" disabled>Update Status</button></div>
        <button class="jill-inbox__row-end" aria-expanded="true" aria-label="Synthetic detail open">⌄</button></div>${details}</article></div>
    </main></s-page>`,
  "hq-request-detail":()=>`<s-page heading="JILL HQ — WORK / Request details" inlineSize="large"><main class="jill-inbox jill-request">
    <nav class="jill-inbox__nav"><span class="jill-inbox__back">← Requests</span><span class="jill-inbox__readonly">WORK · READ ONLY</span></nav>
    <header class="jill-request__header"><p class="jill-inbox__eyebrow">CUSTOM REQUEST · SYNTHETIC</p>
      <div class="jill-request__heading"><div><h2>Request #SYNTH-1042</h2><p>Submitted Nov 8, 2026 · synthetic time</p></div><span class="jill-request__status">In review</span></div></header>
    <p><span class="jill-request__inline-link">Open request conversation →</span> · <span class="jill-request__inline-link">Check Shopify Catalog →</span></p>
    <div class="jill-request__highlights"><div><span>Needed by</span><strong>Nov 14, 2026</strong></div><div><span>Items</span><strong>1</strong></div><div><span>Fulfillment</span><strong>Local pickup</strong></div><div><span>Internal stage</span><strong>Needs quote</strong></div></div>
    <div class="jill-request__grid"><section class="jill-request__panel"><h3>Items &amp; Personalization</h3><p>Celebration topper · quantity 1</p><p>Fictional personalization choices</p><details class="jill-inbox__details" open><summary>Original request · Synthetic</summary><p>Fictional customer instructions and sample source details.</p></details></section>
      <div class="jill-request__side"><section class="jill-request__panel"><h3>Source activity</h3><p>Request submitted · synthetic</p><p>Last update · synthetic</p></section>
      <section class="jill-request__panel"><h3>Request management</h3><button class="fixture-disabled" disabled>Update Status — disabled</button><p>Customer approval and Shopify payments are not enabled here.</p></section></div></div>
    </main></s-page>`,
  "hq-messages":()=>`<s-page heading="JILL HQ — WORK / Messages" inlineSize="large"><main class="jill-messages">
    <header class="jill-messages__intro"><div><h2>Messages</h2><p>Verified Custom Orders are listed here. Private conversations are not connected yet.</p></div><span class="jill-messages__work">SYNTHETIC FIXTURE</span></header>
    <p class="jill-messages__notice">Secure conversation history is not connected in this WORK version. No unread or delivery receipts are implied.</p>
    <p class="jill-messages__hint">2 verified synthetic requests · Unread and delivery receipts are not available.</p>
    <div class="jill-messages__filters"><label>Find request<input class="fixture-field" placeholder="Request ID or status"></label><label>Request status<select class="fixture-field"><option>All statuses</option></select></label><p>2 of 2 verified requests</p></div>
    <div class="jill-messages__layout"><nav class="jill-messages__threads"><button class="jill-messages__thread jill-messages__thread--active">Request #SYNTH-1042 <span>In review</span><small>Updated Nov 8 · synthetic</small></button><button class="jill-messages__thread">Request #SYNTH-2071 <span>In production</span><small>Updated Nov 7 · synthetic</small></button></nav>
      <section class="jill-messages__conversation"><p class="jill-messages__placeholder">Select a request to view its verified customer-visible timeline. Synthetic fixture only.</p></section></div>
    </main></s-page>`,
  "hq-contact-us":()=>`<s-page heading="JILL HQ — WORK / Contact Us" inlineSize="large"><section class="fixture-card">
    <h2>Contact Us inbox</h2><p>Customer questions and Custom Order Requests use separate verified source records until the unified ticket bridge is certified.</p>
    <div class="fixture-message" role="status"><strong>Not connected</strong><p>Shopify's existing Contact Us form remains available. No ticket history or customer messages are assumed missing.</p></div>
    <p>Replies, unread indicators and customer account ownership are not yet authorized for Contact Us tickets.</p></section></s-page>`,
  "hq-catalog":()=>`<s-page heading="JILL HQ — Catalog" inlineSize="large"><main class="jill-catalog">
    <div class="jill-catalog__heading"><div><span class="jill-inbox__back">← Home</span><h2>Shopify Catalog</h2><p>Read-only synthetic sample; manage actual products in Shopify.</p></div><span class="jill-catalog__source">SYNTHETIC FIXTURE</span></div>
    <nav class="jill-workspace__tabs"><a aria-current="page">Products</a><a>Collections</a><a>Inventory</a><a>Locations</a></nav>
    <form class="jill-catalog__search"><label>Find a Shopify product<input class="fixture-field" placeholder="Sample item"></label><button class="fixture-disabled" disabled>Search disabled</button></form>
    <div class="jill-catalog__meta"><strong>1 fictional record on this page</strong><span>Fixture timestamp · currency USD</span></div>
    <div class="jill-catalog__table"><div class="jill-catalog__columns"><span>Product</span><span>Status</span><span>Shopify quantity</span><span>Variants / price / SKU</span><span>Manage</span></div>
      <article class="jill-catalog__row"><div class="jill-catalog__cell jill-catalog__identity" data-label="Product"><strong>Sample Party Topper</strong><span>Vendor: Fictional Studio</span><span>Type: Decoration</span><span class="jill-catalog__handle">sample-party-topper</span></div>
      <div class="jill-catalog__cell" data-label="Status"><span class="jill-catalog__status jill-catalog__status--active">Active</span></div>
      <div class="jill-catalog__cell" data-label="Shopify quantity">Quantity unavailable<small>Synthetic fixture; inventory tracking and production capacity are not represented.</small></div>
      <div class="jill-catalog__cell jill-catalog__variants" data-label="Variants"><div><strong>Default</strong><span>$18.00 USD</span><code>SKU SAMPLE-01</code></div></div>
      <div class="jill-catalog__cell" data-label="Manage"><button class="fixture-disabled" disabled>Shopify link disabled</button></div></article></div></main></s-page>`,
  "hq-settings":()=>`<s-page heading="JILL HQ — Settings" inlineSize="large"><main class="jill-inbox">
    <span class="jill-inbox__back">← Home</span><h2>Access &amp; permissions</h2><p>Configuration status, not proof of a delivered message or saved quote.</p>
    <h3>WORK connections · synthetic sample</h3><ul class="jill-workspace__scope-list"><li>Custom Order requests: Source configured — inspect synthetic Requests</li><li>Shopify Catalog: read-only sample</li><li>Customer conversations: Two-sided conversation read disabled</li><li>Quote drafts: Durable Save/Reload disabled</li></ul>
    <h3>Available actions</h3><ul class="jill-workspace__scope-list"><li>catalog.read: Shopify scope not checked · HQ preview only</li><li>draft.create: disabled</li></ul>
    <details class="jill-workspace__disclosure"><summary>Session details &amp; technical permissions</summary><p>Identity and scopes are fictional and not verified.</p></details>
    </main></s-page>`,
  "myjill-overview":()=>myPage(`<s-section><s-box background="subdued"><s-stack><s-heading>Welcome back, Sample Shopper! ✨</s-heading><s-text>Good things are worth celebrating. Your JILL favorites and updates start here.</s-text>
    <s-box><s-stack><s-text color="subdued">Synthetic Rewards balance</s-text><s-heading>120 sample points</s-heading><s-text color="subdued">No points are real or redeemable in this preview.</s-text><s-stack direction="inline"><s-button variant="primary" disabled>Explore Rewards</s-button><s-button disabled>View Coupons</s-button></s-stack></s-stack></s-box></s-stack></s-box></s-section>
    <s-section><s-heading>Your requests &amp; celebrations</s-heading><s-grid><s-box><s-heading>Custom Orders</s-heading><s-text>Fictional requests and synthetic updates.</s-text><s-button disabled>Track requests</s-button></s-box><s-box><s-heading>Celebrations</s-heading><s-text>A future home for important dates and themes.</s-text><s-button disabled>Explore dates</s-button></s-box></s-grid></s-section>`),
  "myjill-custom-orders":()=>myPage(`<s-section><s-stack direction="inline"><s-heading>Your Custom Orders</s-heading><s-badge>2 synthetic requests</s-badge></s-stack><s-text>A little magic in the making — synthetic sample only.</s-text>
    <s-box><s-stack direction="inline"><s-stack><s-text color="subdued">JILL CUSTOM REQUEST · SYNTH-1042</s-text><s-heading>Birthday Cake Topper</s-heading><s-text>Requested Nov 14 · synthetic</s-text></s-stack><s-badge tone="success">In production</s-badge></s-stack>
      <s-divider/><s-heading>Request details</s-heading><s-text>Personalized topper · Qty 1</s-text><s-text>Needed by Nov 14 · Local pickup</s-text><s-divider/><s-heading>Tracking history</s-heading><s-text>Fictional status event · no actual order or fulfillment.</s-text></s-box></s-section>`),
  "myjill-messages":()=>myPage(`<s-section><s-heading>Messages</s-heading><s-text color="subdued">Your private conversations with JILL about Custom Orders. Synthetic fixture only.</s-text>
    <s-stack direction="inline"><s-badge>2 synthetic threads</s-badge><s-text color="subdued">Unread counts are not available.</s-text><s-button variant="secondary" disabled>Refresh disabled</s-button></s-stack>
    <s-grid gridTemplateColumns="minmax(0, 1fr) minmax(0, 1.6fr)">
      <s-box background="subdued"><s-stack><s-heading>Conversations</s-heading><s-button variant="primary" disabled>SYNTH-1042 · Birthday Topper · JILL replied</s-button><s-button disabled>SYNTH-2071 · Party Banner · No messages yet</s-button></s-stack></s-box>
      <s-box><s-stack><s-heading>Birthday Cake Topper</s-heading><s-text color="subdued">SYNTH-1042 · Last request activity: Nov 8 · synthetic</s-text><s-divider/><s-heading>Conversation · fictional sample</s-heading>
      <s-box background="subdued"><s-text type="strong">JILL · SYNTHETIC</s-text><s-text>Your sample design is ready for your review.</s-text><s-text color="subdued">Nov 8, 2026 · synthetic</s-text></s-box>
      <s-box background="subdued"><s-text type="strong">You · SYNTHETIC</s-text><s-text>Thank you! This is a fictional message.</s-text><s-text color="subdued">Nov 9, 2026 · synthetic</s-text></s-box>
      <s-text color="subdued">Reply controls are disabled in this fixture.</s-text><button class="fixture-disabled" disabled>Reply disabled</button></s-stack></s-box>
    </s-grid></s-section>`),
  "myjill-rewards":()=>myPage(`<s-section><s-heading>JILL Rewards</s-heading><s-text>Sample-only account state. Existing Rewards policy is unchanged.</s-text>
    <s-box background="subdued"><s-stack><s-text color="subdued">Synthetic available balance</s-text><s-heading>120 points</s-heading><s-text>Not connected to a wallet or ledger.</s-text><s-button disabled>Redeem disabled</s-button></s-stack></s-box>
    <s-box><s-heading>How it works</s-heading><s-text>Displayed content is fictional and cannot change balances.</s-text><s-button disabled>View sample coupons</s-button></s-box></s-section>`),
  "myjill-coupons":()=>myPage(`<s-section><s-heading>Coupons</s-heading><s-text>Your personal JILL Rewards coupons · synthetic only.</s-text>
    <s-heading>For you</s-heading><s-box><s-stack direction="inline"><s-stack><s-text color="subdued">YOUR REWARD · SYNTHETIC</s-text><s-heading>$5 OFF · SAMPLE</s-heading></s-stack><s-badge tone="success">Sample</s-badge></s-stack>
      <s-box background="subdued"><s-text color="subdued">Code</s-text><s-text type="strong">SAMPLE-NOT-REDEEMABLE</s-text></s-box><s-text color="subdued">Fictional coupon; no value, no minimum and no expiry.</s-text><s-button disabled>Use Now disabled</s-button></s-box>
    <s-heading>Storewide offers</s-heading><s-box><s-text>No connected Shopify promotions. Synthetic empty state only.</s-text></s-box></s-section>`),
};
function myPage(body){return `<s-page heading="My JILL" subheading="Your little corner of JILL — synthetic preview only">
  <s-section><s-stack><s-heading>Explore My JILL</s-heading><s-text color="subdued">Synthetic account preview · navigation stays within this fixture.</s-text>
    <s-box background="subdued"><s-stack direction="inline">${myJillNav.map(([label,target,available])=>available
      ?`<s-button variant="${location.pathname.endsWith(target)?'primary':'secondary'}" data-screen="${target}">${label}</s-button>`
      :`<s-button variant="secondary" disabled title="Not included in this visual scope">${label}</s-button>`).join("")}</s-stack></s-box></s-stack></s-section>
  ${body}<s-section><s-box background="subdued"><s-stack><s-heading>More of your JILL account</s-heading><s-text color="subdued">Shopify Orders and Profile are not opened from this synthetic preview.</s-text><s-stack direction="inline"><s-link>Orders</s-link><s-link>Profile &amp; addresses</s-link></s-stack></s-stack></s-box></s-section>
  </s-page>`}
function navigation(screen,kind){
 if(kind!=="hq")return "";
 const items=hqNav;
 return `<nav class="jill-workspace__navigation" aria-label="${kind==="hq"?"JILL HQ":"My JILL"} synthetic navigation">
  <span class="jill-workspace__brand">${kind==="hq"?"JILL<span>HQ</span>":"My JILL"}</span>
  <div class="jill-workspace__navigation-items">${items.map(([label,id])=>`<a href="/${id}" ${id===screen?'aria-current="page"':''}>${label}</a>`).join("")}</div>
  <span class="jill-workspace__work">SYNTHETIC</span></nav>`;
}
const routeScreen=location.pathname.split("/").filter(Boolean).at(-1);
const screen=new URLSearchParams(location.search).get("screen")||
  (screens[routeScreen]?routeScreen:"hq-home");
const config=screens[screen]||screens["hq-home"];
for(const name of [...(config.kind==="hq"?["hq-theme.css"]:[]),...(config.styles||[])]){
 const link=document.createElement("link");link.rel="stylesheet";link.href="/styles/"+name;document.head.append(link);
}
const root=document.querySelector("#preview");
root.innerHTML=`<div class="fixture-banner">SYNTHETIC LOCAL PREVIEW · FICTIONAL DATA · NO SHOPIFY AUTH · NO EXTERNAL APIS OR PROVIDER WRITES</div>
  <div class="fixture-frame"><div class="fixture-top"><h1>${config.label}</h1><span class="fixture-chip">Fixture only · ${config.kind==="hq"?"HQ":"My JILL"}</span></div>
  <div class="${config.kind==="hq"?"jill-workspace":"fixture-platform"}">${navigation(screen,config.kind)}<div class="fixture-content">${layouts[screen]()}</div></div>
  <p class="fixture-footer">Not the authenticated Shopify app. All names, statuses, dates, balances, quantities, coupon-like strings, and conversations are fictional.</p></div>`;
root.addEventListener("click",event=>{
 const link=event.target.closest("[data-screen]");
 if(link){location.pathname="/"+link.dataset.screen;return;}
 const row=event.target.closest(".jill-inbox__row-trigger");
 if(row){
  const open=row.getAttribute("aria-expanded")!=="true";
  row.setAttribute("aria-expanded",String(open));
  const card=row.closest(".jill-inbox__card");
  card.querySelector(".jill-inbox__order-details").hidden=!open;
  card.querySelector(".jill-inbox__row-end")?.setAttribute("aria-expanded",String(open));
 }
});
