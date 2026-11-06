// WORK HQ product Catalog read-only stock display.
// Shopify Product.totalInventory does NOT establish whether all variants
// track inventory or whether any quantity is actually available for sale.
// Only the separately authorized variant Inventory view reports tracking.
// No network calls, Shopify mutations, backend entitlement or PII.
export function describeWorkCatalogProductInventory(value){
  if(value===null||value===undefined)
    return Object.freeze({
      label:'Quantity unknown',
      detail:'Shopify did not report a product total. Check variant tracking in Inventory.',
    });
  if(!Number.isSafeInteger(value))throw Error('invalid_shopify_product_inventory');
  return Object.freeze({
    label:'Shopify reports '+value,
    detail:value===0
      ?'Zero reported is not proof the item is out of stock; inventory tracking may be off.'
      :'This is Shopify\'s reported product total, not verified available stock or custom-production capacity.',
  });
}
