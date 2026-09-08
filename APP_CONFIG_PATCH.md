# JILL Custom Form — linked app configuration

This repo is for the already-installed **JILL Custom Form** app.

- App handle: `jill-custom-form`
- Client ID: `ebf1a69d82f46619d2f2945faab78afa`
- Current Admin scopes are preserved by the deployment workflow.

First pull the real app configuration from Shopify instead of inventing a replacement file:

```bash
npm install
npm run link -- --client-id ebf1a69d82f46619d2f2945faab78afa
```

This document remains the local setup companion to `.github/workflows/deploy-customer-account.yml`;
the repository does not contain a replacement app configuration. Preserve the linked app's scopes
and OAuth redirect URLs using the same maintained script as deployment:

```bash
node scripts/merge-shopify-scopes.mjs shopify.app.toml
```

If linking produced a named configuration, pass that filename instead. The script adds the
required Admin and Customer Account scopes without removing existing scopes.

The customer-account extensions use direct Customer Account API access, so each extension also declares:

```toml
[extensions.capabilities]
api_access = true
```

`customer_write_customers` is used only for customer-owned account actions such as requesting a JILL Rewards redemption through the `jill_rewards.redeem_request_points` and `jill_rewards.redeem_request_nonce` customer metafields. The server remains the only owner of points calculations and discount creation.

The dashboard reads customer name/account data and JILL/JILL Rewards metafields when Shopify exposes those protected fields. Both request metafield definitions must permit Customer Account read/write access; balance and wallet definitions should permit read access only. Scopes alone do not grant metafield access. Partial dashboard query errors are surfaced rather than treated as an empty rewards wallet.

After configuration is linked and scopes are merged:

```bash
npm run shopify -- app config validate --json
npm run build
```

Deploy only after review and approval. Deployment makes the extensions available to the store. The **JILL Account Home** block can be placed on the customer-account Orders page in the Checkout and accounts editor, and the **My JILL Dashboard** full page can be added to the customer-account navigation.
