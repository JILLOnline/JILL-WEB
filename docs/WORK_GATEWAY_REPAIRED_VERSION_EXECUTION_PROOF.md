# WORK Custom Order gateway — read-only proof of 0% repaired version execution

## Owner's successful 100/0 deployment

Owner Windows verified deployment `f6809b0e-c8b7-47b6-9cc9-13d071d1ecbb`:

- Original `jill-work-custom-orders-qa` version
  `408bdf7c-eb20-4b6e-97dd-3d3b293c6120` receives 100% normal traffic.
- Repaired inactive-at-0 version
  `225cdbb4-46f5-492e-801d-6726bea2703e` is in the deployment at 0%.
- Anonymous health and no-token account denial passed.
- No WORK customer submission, paid plan, R2, LIVE/KEEP,
  Worker upload, normal traffic promotion or payment occurred.

**Do not rerun `deploy-repair-zero`.** Its authorization is spent.

## Why another read-only check?

Cloudflare documents that a version-override header can silently
fall back to the normal traffic split if invalid or not applied.
Since both Worker versions run identical code, a 200 `/healthz`
response alone does not prove which version executed.

Cloudflare Wrangler supports `tail --version-id`. The new
single local command starts a temporary server-side filtered
real-time tail on the **repaired version only**, waits for
the connection, makes exactly ONE pinned anonymous GET to
`/healthz?jill_work_tail_probe=<random UUID>`, then checks that
the same unique URL appears in the repaired version's execution
events with an expected timestamp. The Worker still has to return
strict 200 `WORK_CUSTOM_ORDERS_QA` JSON; the current Cloudflare
100% original / 0% repaired allocation and deployment ID are
checked before and after.

## Owner PowerShell command

```powershell
cd C:\Users\itzen\JILL-WEB
if ((git branch --show-current).Trim() -ne 'jill/rewards-work') { throw 'STOP: Wrong branch' }
if (git status --porcelain --untracked-files=no) { throw 'STOP: Tracked changes exist' }
git pull --ff-only origin jill/rewards-work
if ($LASTEXITCODE -ne 0) { throw 'STOP: Git sync failed' }
npm.cmd run work:custom-order:gateway:prove-repaired-execution
if ($LASTEXITCODE -ne 0) { throw 'HOLD: Do not infer candidate execution or rerun deployment' }
```

### Privacy and budget constraints

The command never prints, saves or exports raw tail log events,
which may contain URLs, headers or customer metadata. It reads
the stream only long enough to locate the unique anonymous
health request and shuts down the session after proof or a
bounded timeout. It does not enable Logpush, Workers Logs,
Logpush destinations, Tail Workers, billing plans, R2, paid
services, database writes or Shopify endpoints.

If the existing Cloudflare Free account or Wrangler credentials
do not allow tailing, or the Tail connection/format differs,
it prints **HOLD** rather than weakening checks or enabling
any paid observability product. The user can consult the
Cloudflare dashboard for ordinary traffic diagnostics as needed.

**Even on PASS:** the proof covers only execution of the
version-pinned anonymous GET. It does NOT prove the repaired
Cloudflare secret matches Google's key, that an authenticated
Shopify app-proxy request reaches the repaired version, or
that submitting a Custom Order will now succeed. That test
needs a distinct, approved and controlled synthetic-only plan
with exact request ID reconciliation. No real customer record
can be used as a disposable test.

References:
https://developers.cloudflare.com/workers/versions-and-deployments/version-overrides/
https://developers.cloudflare.com/workers/wrangler/commands/workers/
https://developers.cloudflare.com/workers/observability/logs/real-time-logs/
