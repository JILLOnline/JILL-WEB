# JILL-WEB — Customer Account Dashboard

JILL's Shopify **New Customer Accounts** dashboard, built as Customer Account UI extensions on API version **2026-07**.

## What this repo adds

### My JILL Dashboard
Full-page extension (`customer-account.page.render`) with:
- personalized greeting
- `Subscribed ★` recognition
- current custom-request status and dates
- next celebration/reminder
- saved theme, colors, products, preferences, contact method, and location
- recent orders and statuses
- quick links to Custom Order, Shop JILL, and Contact JILL

### JILL Account Home
Orders-index block (`customer-account.order-index.block.render`) that turns the default account landing area into a useful JILL home with:
- greeting + subscriber badge
- custom-request snapshot
- next celebration
- latest order
- direct link to the full dashboard

## Shopify app
This project is intended to attach to the already-installed **JILL Custom Form** app.

- App handle: `jill-custom-form`
- Client ID: `ebf1a69d82f46619d2f2945faab78afa`
- Existing Admin scopes: `read_customers,write_customers`

Do not replace the app's existing configuration manually. Use Shopify CLI `app config link` to pull the current configuration first, then add the required Customer Account scopes.

## Required scopes

The deployed app configuration must preserve the current Admin scopes and add:

```toml
[access_scopes]
scopes = "read_customers,write_customers,customer_read_customers,customer_read_orders"
```

## Store-side data already prepared

The JILL store already has structured `jill.*` CUSTOMER metafield definitions with Customer Account API read access for the dashboard fields. The customer-account navigation has also been expanded to Orders, Profile, Custom Orders, Shop, and Contact JILL.

## Development

```bash
npm install
npm run link -- --client-id ebf1a69d82f46619d2f2945faab78afa
npm run validate
npm run dev
```

## Deploy

After linking and merging the required scopes:

```bash
npm run deploy
```

After deployment:
1. Approve any newly requested customer-account scopes on the store.
2. Add **JILL Account Home** to the Orders page in the Checkout and accounts editor.
3. Add **My JILL Dashboard** to the customer account navigation.

## Important

Customer Account UI extensions render through Shopify Polaris web components. They intentionally do not inject arbitrary CSS into `account.jillonlinestore.com`; the JILL logo, pink account branding, typography, and global account colors remain controlled by Shopify's Checkout and accounts branding editor.
