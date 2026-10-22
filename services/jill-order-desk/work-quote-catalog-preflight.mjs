// JILL HQ WORK quote source-only action plan: saved draft -> canonical signed
// request -> exact Shopify variant snapshot, with zero Shopify/Google/D1 IO.
//
// IMPORTANT: this does NOT authenticate anything; its future caller MUST be
// the verified Owner route and MUST provide exact server-read sources.
// A positive result means one MAY request a new Shopify calculation under
// separately reviewed authorization, never publish or invoice a quote.
import {inspectWorkQuoteCommerceHandoff}
 from './work-quote-commerce-handoff.mjs';
import {reconcileWorkQuoteWithCatalog}
 from './work-quote-shopify-catalog-bridge.mjs';

const actionByReason=Object.freeze({
 canonical_source_unverified:'verify_original_request',
 verified_draft_unavailable_or_stale:'reload_saved_quote',
 native_line_limit:'review_native_line_limit',
 shopify_customer_unverified:'verify_shopify_customer',
 fulfillment_unverified:'verify_fulfillment',
 unmapped_order_instructions:'map_customization_terms',
 variant_or_personalization_requires_review:'map_exact_variant',
 per_unit_or_reference_mapping_required:'map_per_unit_personalization',
 variant_allocations_require_review:'map_per_unit_personalization',
 duplicate_shopify_variant_needs_consolidation:'consolidate_variants',
 unverified_item_personalization:'map_customization_terms',
 personalization_exceeds_native_limit:'map_customization_terms',
 custom_fee_lines_not_mapped:'map_extra_fees',
 manual_tax_must_be_recalculated:'recalculate_tax_natively',
 discount_authorization_required:'verify_rewards_discount',
 pickup_shipping_inconsistent:'review_shipping',
 shipping_service_not_approved:'review_shipping',
 full_address_required:'collect_verified_address',
 native_quote_input_unverified:'verify_native_line_inputs',
 quote_money_unverified:'review_quote_prices',
 manual_and_native_totals_disagree:'review_quote_prices',
 quote_draft_not_verified:'reload_saved_quote',
 catalog_snapshot_missing_or_stale:'refresh_shopify_catalog',
 variant_count_changed:'review_variant_allocations',
 shopify_variant_changed:'review_variant_allocations',
 shopify_product_not_active:'review_catalog_product',
 catalog_price_unverified:'review_shopify_price',
 catalog_price_review_required:'compare_shopify_price',
});
const noCommerce=Object.freeze({
 can_publish:false,can_invoice:false,can_create_order:false,
 can_send_email:false,can_charge_customer:false,
});
const held=(stage,reason)=>Object.freeze({
 state:'held',stage,reason:typeof reason==='string'?reason:'unknown',
 next_action:actionByReason[reason]||'manual_owner_review',
 ...noCommerce,source_only:true,
 native_shopify_calculation_performed:false,
});
export function inspectWorkQuoteCatalogPreflight({
 enabled=false,submissionId,detail,draft,customerGid,address,
 shippingTitle,catalogSnapshot,nowMs=Date.now(),
}={}){
 if(enabled!==true)return held('disabled','owner_quote_preflight_disabled');
 // Native inputs are assembled ONLY from a source-revision-matched saved
 // draft and original signed request. Browser-provided amounts must never
 // substitute for either canonical source.
 const handoff=inspectWorkQuoteCommerceHandoff({
  submissionId,detail,draft,customerGid,address,shippingTitle,
 });
 if(handoff.state!=='ready_for_shopify_calculation')
  return held('saved_quote',handoff.reason);
 const check=reconcileWorkQuoteWithCatalog({
  handoff,snapshot:catalogSnapshot,nowMs,maxAgeMs:300000,
 });
 if(check.state!=='ready_for_native_shopify_calculation')
  return held('shopify_catalog',check.reason);
 // No customer's GID, address, notes or quote payload in the summary.
 // Native calculation intent stays in the internal handoff, not in this
 // review-only object or a browser-facing API.
 return Object.freeze({
  state:'ready_for_native_shopify_calculation',
  stage:'owner_review',reason:null,
  next_action:'request_fresh_shopify_calculation',
  verified_line_count:handoff.calculation_intent.lines.length,
  catalog_verified_at_ms:check.catalog_verified_at_ms,
  shopify_totals_verified:false,
  customer_approval_recorded:false,
  ...noCommerce,source_only:true,
  native_shopify_calculation_performed:false,
 });
}
