# Production QA with an existing Playwright runtime

These two standalone Node scripts let an authorized executor inspect the public playable using an already-installed Playwright runtime and an installed Chrome/Edge executable. They do **not** require this project's `node_modules`, `@playwright/test`, a package installation or a browser download.

The executor supplies verified absolute paths. Do not guess the user's executable paths or access a personal browser profile.

## Fast boot and screenshots first

```text
node scripts/production-boot-smoke.mjs PLAYWRIGHT_MODULE_FILE BROWSER_EXECUTABLE OUTPUT_DIRECTORY [URL]
```

Quote every path containing spaces. `PLAYWRIGHT_MODULE_FILE` may be the existing runtime's `playwright/index.mjs`; `BROWSER_EXECUTABLE` is an existing Edge or Chrome executable. The default URL is:

https://rocksnake-playable-test.pearly-haven-3558.chatgpt.site

The script:

- Starts one fresh headless browser with `chromiumSandbox: true`, no custom launch arguments and no personal profile. Explicitly removes Playwright’s default `--enable-unsafe-swiftshader` argument through `ignoreDefaultArgs`; it does not enable unsafe software rendering.
- Uses separate fresh 360×640 and 1280×720 contexts.
- Records HTTP status, exact document byte count/SHA-256, uncaught errors, console errors, visible fallback text and actor markers.
- Saves a screenshot per size and `boot-report.json`.
- Reports only boot/scene-presence status. A person still needs to inspect the screenshots. It does not claim gameplay, touch or GPU performance.

If startup or WebGL2 fails, keep the failed report. Do not silently disable sandboxing, add graphics/security flags or switch to unsafe SwiftShader to make the test pass.

## Bounded visible-UI input smoke

After the boot succeeds:

```text
node scripts/production-smoke.mjs --playwright-module PLAYWRIGHT_MODULE_FILE --executable BROWSER_EXECUTABLE --output OUTPUT_DIRECTORY
```

Optional `--url` selects another explicitly authorized production URL. `--help` prints usage without launching a browser.

This script uses ordinary Playwright APIs and real mouse input against visible DOM targets. It checks initial mining earnings (up to 30 seconds per viewport), barrel opening, drag/merge, coin bonus, pad purchase, placement, Help pause/return and repeated Restart. Individual failures and blocked dependent actions are recorded rather than being treated as passes. It saves screenshots, console/page errors and `report.json`.

The production DOM markers are the visible interaction targets rendered by the game. Neither script reads development hooks, alters GameState, injects commands or grants coins. A portrait mouse viewport is **not** a touch test.

This bounded smoke does not replace the project's full E2E suite, real touch input, bomb targeting, offline request interception, five-minute soak or device performance checks. The actual report, not the existence of these scripts, is execution evidence.

## Portability

- Node 24.19.0 is pinned for project development. These `.mjs` scripts use built-in Node modules plus the explicitly supplied existing Playwright runtime.
- `.npmrc` contains only `save-exact=true`; there is no Linux-specific cache path. Normal npm cache configuration stays with the user's environment.
- No new dependency was added for this QA route.
- The complete E2E suite still uses the standard bundled Playwright Chromium (`npx playwright install chromium`) when the owner authorizes that separate setup. It is not required by these standalone scripts.
- Results should be stored under an approved local output directory, preferably `test-results/`; the default input-smoke output directory is ignored by Git.
