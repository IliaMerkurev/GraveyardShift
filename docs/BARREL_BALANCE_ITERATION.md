# Barrel reward balance — prototype/0.2

Owner correction, 2026-10-13:

- Remove the unrequested +50 coins attached to rewind. Coin barrel contents and their grant are removed from configuration, content types, selection and opening commands. Opening a barrel and activating rewind do not award currency. Unknown content is rejected without opening or granting a substitute reward.
- After the fixed starter sequence, random worker drops have 50% probability; bombs have 15%. Rewind, five-second pause and permanent slowdown share the remaining 35% equally: 35% / 3 each (approximately 11.6667%). Pause is the remaining interval after worker, bomb, rewind and slowdown thresholds.
- Preserve the fixed starter order, replacing only its third coin outcome with plain rewind. Seven guaranteed starter workers and the appended slowdown stay in place. The fixed starter sequence is deliberately not sampled from the later random percentages.
- Coins from rock destruction, including mining and bombs, stay unchanged. Worker levels, movement, bonus effects, storage, upgrades and disposal are not retuned.
- Help and current rules describe the new distribution. Earlier test reports and old QA procedures remain historical evidence, not verification of the new economy.

## Verification and publication

Only source review, direct Vite bundling and standalone packaging are authorized. No tests, typecheck, browser, gameplay QA or Dreambook run is performed. Packaging retains its normal embedded-JavaScript syntax and dependency guards. The owner performs gameplay QA.

Canonical publication parent: 5197579c1d510210d93455f53fbb76a156dbba88. Matching local base: d64b03d34837b41cc2515b325d6f469376f9c232. Baseline tree: cf4a7360d5795e1d588812c269ab4d63a6bc79b1. Publish the frozen content delta only to the authorized prototype/0.2 branch, without pushing divergent local history or changing main.
