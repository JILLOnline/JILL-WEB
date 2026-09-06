# JILL Custom Form — app configuration patch

This repo is for the already-installed **JILL Custom Form** app.

- App handle: `jill-custom-form`
- Client ID: `ebf1a69d82f46619d2f2945faab78afa`
- Current Admin scopes: `read_customers,write_customers`

First pull the real app configuration from Shopify instead of inventing a replacement file:

```bash
npm install
npm run link -- --client-id ebf1a69d82f46619d2f2945faab78afa
```

Then preserve the existing scopes and add the Customer Account scopes required by the dashboard:

```toml
[access_scopes]
scopes = "read_customers,write_customers,customer_read_customers,customer_read_orders"
```

The two extensions use direct Customer Account API access, so each extension also declares:

```toml
[extensions.capabilities]
api_access = true
```

The dashboard reads customer name/marketing state when Shopify exposes those protected fields. If protected-data approval is incomplete, the UI falls back gracefully instead of requiring those values to render the rest of the account data.

After configuration is linked and scopes are merged:

```bash
npm run build
npm run deploy
```

Deployment makes the extensions available to the store. The **JILL Account Home** block still has to be placed on the customer-account Orders page in the Checkout and accounts editor, and the **My JILL Dashboard** full page can then be added to the customer-account navigation.
