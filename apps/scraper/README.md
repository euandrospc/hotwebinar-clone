# scraper

Captures the original platform with Playwright. Local-only — never deploy.

## Setup

From the repo root:

```bash
pnpm install
cd apps/scraper && pnpm exec playwright install chromium --with-deps && cd -
cp .env.example .env
# Fill in TARGET_BASE_URL, TARGET_LOGIN_EMAIL, TARGET_LOGIN_PASSWORD
```

## Pipeline

The capture phase has four stages. Run them in order.

1. **Record** — opens a headed browser; you log in and click around. On close, saves the auth state and the list of visited URLs.

   ```bash
   pnpm scrape:record
   ```

2. **Replay** — re-visits each recorded URL headless, captures HTML, full-page screenshot, HAR, and a structured `requests.json`.

   ```bash
   pnpm scrape:replay
   ```

3. **Crawl** — starts at `CRAWL_START_ROUTE` and BFS-walks every internal `<a>` matching `SIDEBAR_SELECTOR`. Same per-page artifacts as replay. Default headless; pass `--headed` to watch.

   ```bash
   pnpm scrape:crawl
   pnpm scrape:crawl -- --headed
   ```

4. **Analyze** — reads every `requests.json` from the latest run, infers schemas, and writes `REPORT.md` plus the JSON artifacts that drive the next planning cycle.

   ```bash
   pnpm scrape:analyze
   ```

   Or all three non-interactive stages chained:

   ```bash
   pnpm scrape:all
   ```

## Output layout

```
apps/scraper/
├── recorded/                                      gitignored
│   ├── auth-state.json
│   └── flow.spec.ts
└── capture/                                       gitignored
    ├── <run-id>/
    │   ├── replay/<slug>/{page.html,screenshot.png,network.har,requests.json,meta.json}
    │   ├── crawl/<slug>/{page.html,screenshot.png,requests.json,meta.json}
    │   └── analysis/{endpoints.json,entities.json,pages.json,REPORT.md}
    └── latest/                                    copy of the most recent run
```

## Tests

```bash
pnpm --filter scraper test
pnpm --filter scraper typecheck
```

Unit tests cover `lib/*` (network, auth, schema-infer, report) and the analyze helpers (`normalizePath`, `guessEntityName`). The crawl stage has an integration test against a local fixture HTTP server. The interactive record stage has no automated test — validate manually by running `pnpm scrape:record` against a real environment.

## Configuration

All env vars are optional except the three `TARGET_*`. See `../../.env.example` for the full list with defaults.
