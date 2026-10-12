# JILL controlled rollback runbook

Before each deployment record: exact source commit and SHA, component, tenant/store/app/theme/backend IDs, deployed version, secret references **not values**, contract version, dataset/ledger backup marker, traffic/monitoring baseline, operator and approval.

* Website: revert to the last verified Shopify theme/version without replacing accounts or rewriting forms/data.
* Account extension: restore last verified app version; verify customer session, Rewards, Coupons, My JILL state, and permission compatibility. Changing the Git branch does not by itself roll back an app release.
* Cloudflare: restore previously known-good Worker version for the **same** Worker and bindings; confirm rate limiter and /healthz; verify unauthenticated reads fail.
* Google Apps Script: repoint the same verified deployment to approved prior version only with schema compatibility and ledger reconciliation; NEVER discard newly written ownership/event rows or overwrite the sheet with an old backup.
* Suspected privacy leak: stop customer-read capability before further testing; preserve logs/evidence without tokens/private data in reports; audit affected access and take incident-response steps.

After rollback: capture time, old/new versions, observed impact, data reconciliation and explicit restart authorization. No cross-environment credential substitution, forced Git history rewrite or blind data restore.
