## E2E seed expectations

These specs assume the following webinars are seeded in the test DB:
- `e2e-funnel` — JIT, ACTIVE, with EXTERNAL hlsUrl pointing to a small public HLS asset
- `e2e-webhook` — id (admin must own), with one FAILED WebhookDelivery row
- `e2e-future` — UNICO, ACTIVE, startDate +1h
- `e2e-past` — UNICO, ACTIVE, startDate −2h, endDate −1h

Run via:

    pnpm --filter web e2e

Specs that depend on infrastructure not present at run-time should `test.skip()` themselves; see existing B2 pattern in this repo if present.
