# JILL HQ WORK — 0003 Owner-gated D1 Release

## Authority / scope

**This code is not a release approval and has not executed a D1 write.**
Only the OWNER can run `npm.cmd run work:hq:inbox:0003:release:apply`
on the clean, synced WORK branch of their own Windows computer.
This command performs a **remote WORK D1 migration** once the owner
explicitly types `APPLY JILL WORK D1 0003 ONLY` and confirms the
Wrangler migration prompt. Do not run it unattended, in CI, or without
reviewing the current database and recovery state. Existing WORK v34
remains the sole traffic authority; LIVE, KEEP, Rewards, Shopify and
Google Apps Script are out of scope.

The only allowed schema migration is
`services/jill-order-desk/migrations/0003_work_verified_inbox_index.sql`.
The account's actual migration ledger was independently confirmed to
hold exactly 0001 and 0002; WORK has four JILL tables and no inbox index.
The 0004 attachment registry remains a **proposal** in `migration-plans/`.
No approval for 0004 or media preview follows from this procedure.

## Commands on the owner's Windows PC

From `C:\Users\itzen\JILL-WEB`:

```powershell
git pull --ff-only origin jill/rewards-work
if ($LASTEXITCODE -ne 0) { throw 'STOP: Git sync failed' }
npm.cmd run test:work-hq-inbox-0003-release
if ($LASTEXITCODE -ne 0) { throw 'STOP: Offline release guard failed' }
npm.cmd run work:hq:inbox:0003:release:inspect
if ($LASTEXITCODE -ne 0) { throw 'STOP: Remote read-only inspection failed' }
```

The final `inspect` command is **read-only** and prints no bookmark.
It confirms active WORK v34, exact D1 identity, four-table schema,
two-ledger migration baseline, presence of one and only one pending
migration file, and current Time Travel capability.

After that passes and the owner explicitly decides to change WORK D1:

```powershell
npm.cmd run work:hq:inbox:0003:release:apply
if ($LASTEXITCODE -ne 0) { throw 'STOP: Inspect migration outcome; never blindly retry' }
```

## What the guarded apply actually does

1. Require Windows and an interactive local terminal (CI/unattended use
   refused), a clean Git working tree at exact `origin/jill/rewards-work`
   HEAD, installed local Wrangler, and the exact WORK D1 config and
   original 0001–0003 migration directory. It checks the 0003 SQL is
   the sole pending migration **by comparing the full remote schema and
   D1 ledger**. 0004 cannot be picked up by Wrangler.
2. Verify the existing `JILL_WORK_HQ_FAST_INBOX_ENABLED` flag is
   absent and that the live WORK Worker remains v34. A migration alone
   cannot activate the optional cache. The signed Google QA remains
   the canonical original inbox and status authority.
3. Ask for the exact owner approval phrase, then redo the remote
   read-only preflight and check Git + SQL fingerprint again.
4. Obtain a **fresh** Time Travel bookmark without printing it.
   On the local Windows PC, encrypt a JSON recovery record containing
   the bookmark, exact WORK database UUID, UTC timestamp and source
   commit using the current Windows user's DPAPI and write the
   ciphertext exclusively to a new file under the user's
   `%LOCALAPPDATA%\JILL-WEB\recovery` folder (outside Git).
   Read back ciphertext and verify same-user DPAPI round-trip.
   **The plaintext bookmark is never printed, logged, stored in Git,
   sent to CI or passed as a subprocess command-line argument.**
5. Redo the **four-table + two-ledger preflight** after the recovery
   checkpoint, plus Git and 0003 fingerprint checks. Any drift
   immediately cancels before D1 writes.
6. Invoke the exact Wrangler command
   `d1 migrations apply jill-order-desk-work --remote --config ./wrangler.canary.jsonc`.
   Wrangler may require another interactive confirmation. The script
   does not supply a `--yes` override.
7. Validate the resulting **five** expected JILL tables, migration
   records 0001/0002/0003 (and no unknown records), and exactly one
   empty seed row with `generation=0` and all cache times zero. It
   reruns the independent live Worker/WORK D1 preflight and requires
   unchanged v34 and disabled fast-inbox flag.

A passing postflight means the schema has been applied, **not**
that the optional distributed inbox cache has been enabled or tested
under live traffic. That switch requires its own separate release.

## Wrangler Windows TTY correction and independent verification

**Observed Owner incident:** after exact WORK v34/UUID preflight,
Windows DPAPI checkpoint creation, and Wrangler listing **one** pending
migration, the old synchronous Node subprocess stopped at Wrangler's
`(Y/n)` prompt. The Owner independently confirmed the real WORK D1
still has **four JILL tables** and exactly two migration records,
with 0003 not recorded. The encrypted checkpoint was retained; no
schema repair or restore is required on this evidence.

The corrected implementation launches the real Wrangler CLI via
**asynchronous `spawn` with `stdio: inherit`**, preserving its own
interactive `(Y/n)` question. No `--yes` / forced confirmation is sent.
The owner must still explicitly approve both the JILL phrase and
Wrangler's confirmation.

Before reattempting a remote write, test the exact two-step Windows
terminal behavior without any Cloudflare request:

```powershell
npm.cmd run work:hq:inbox:0003:terminal:probe
if ($LASTEXITCODE -ne 0) { throw 'STOP: Windows console probe failed' }
```

This asks for `TEST JILL WORK TERMINAL`, then a **synthetic**
`SYNTHETIC Wrangler confirm (Y/n)` prompt. Type `y` to finish.
The probe never contacts D1, produces no bookmark and performs no
database write. If it cannot complete, **do not apply the migration**.
Test results from CI use synthetic pipes; this explicit owner-side
TTY probe tests the real Windows console that CI cannot fully emulate.

Then rerun the existing read-only release inspection to confirm the
four-table and two-ledger pre-migration state. Only if both commands pass
may the owner reattempt the previously approved `release:apply`.
It will generate a **new fresh encrypted recovery bookmark** and will
recheck exact WORK authority immediately before the remote write.
Preserve the older checkpoint as historical recovery evidence.

After a successful migration, run an independent read-only verification:

```powershell
npm.cmd run work:hq:inbox:0003:release:verify
if ($LASTEXITCODE -ne 0) { throw 'STOP: Inspect actual WORK D1 state' }
```

The `release:verify` mode is intentionally distinct from
`release:inspect`: it expects the new five-table/three-ledger state,
one empty index seed, and unchanged v34, and performs **no writes**.
If apply fails or the result is ambiguous, run `release:verify` and
the independent `work:hq:media:d1:inspect` read-only inspector
before discussing any retry. Never auto-reapply or Time Travel restore.

## Errors, recovery and retention

If Wrangler starts the write but returns an error, or postflight cannot
establish the exact final state, output is **ambiguous**. The script
prints `REMOTE WRITE MAY HAVE OCCURRED`, retains the encrypted
checkpoint, and exits with failure. **Never rerun apply blindly.**
Inspect real WORK D1 schema/ledger and current Worker before deciding
whether any manual action is necessary.

No `DROP TABLE`, direct ledger edit, `time-travel restore` or
automatic schema rollback is included. A restore can erase unrelated
Owner/session/status writes since the bookmark; it requires separate
Owner approval after inspecting the time window. Time Travel
bookmarks expire according to the Cloudflare account's retention period,
and a bookmark file is not an indefinite off-site database backup.
DPAPI encryption binds recovery metadata to the current Windows user;
if that Windows profile or its DPAPI keys are lost, the encrypted file
may no longer be decryptable.

Do not post the local checkpoint contents or recovery bookmark in
GitHub, ChatGPT or logs. Follow owner-approved separate key rotation or
storage/export procedures only after an explicit design review.

Official documentation:
- https://developers.cloudflare.com/d1/wrangler-commands/
- https://developers.cloudflare.com/d1/reference/time-travel/

## Deployment hold

This source PR itself must pass all WORK CI and Windows DPAPI tests.
Merging it is **not** migration execution. First certify the release
`--inspect` locally; then the owner may invoke `--apply` and supply
the explicit typed approval and Wrangler confirmation. Only WORK D1
schema 0003 is authorized through that procedure.
