# Worker attack-speed progression — prototype/0.2

Owner feedback on 2026-10-13: increase attack speed starting at level 3; this iteration changes only that progression.

- Levels 1 and 2 retain a 1.2-second swing. Level 3 starts at 1.0 second; each subsequent level multiplies attack frequency by 1.2. Nominal periods: level 4 ≈0.833 s, level 5 ≈0.694 s, level 6 ≈0.579 s.
- Formula: `max(0.1, 1.2 / 1.2^(max(0, level - 2)))`. The exponent is bounded before evaluation, so very high finite levels stay safe. A 0.1-second technical minimum (level 16 onward) leaves six fixed simulation steps per swing at 60 Hz; the existing fixed-step cycle rounds completion up to a simulation tick. This is an attack-animation/simulation guard, not a merge-level cap.
- Mining advances the same normalized phase used by the pickaxe animation. The impact stays at 52% of each swing, with the existing one-hit gate and target retention/range checks. A merge retains the existing clean cycle reset, so a partly completed old swing cannot create an immediate extra hit at its new speed.
- Damage remains 2 / 5 / 11 / 24 / 50, then ×2. Snake speed and acceleration, rock HP, range, targeting, economy, bonuses, drag handling and UI remain unchanged.

## Delivery scope

Only direct Vite bundling and standalone packaging are run, per the owner's manual-testing instruction. No tests, typecheck, browser QA or historical-suite cleanup. The packager's inherent embedded-JavaScript syntax and external-reference checks are packaging checks, not gameplay verification.
