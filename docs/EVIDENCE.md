# Evidence — harness proof-of-catch

Real bugs from the prior build (`origin/archive/harness-v1.1`) that demonstrate the generator↔evaluator separation. Authorship is inferred from the commit subject: a `T##(...)` prefix means the loop authored it; no prefix means Spence authored it by hand.

- **`facda4e`** — `fix(T21): reject open-redirect next param on auth confirm route` — loop-authored, **flawed**. The guard `next.startsWith("/") && !next.startsWith("//")` lets `/\evil.com` through: browsers fold `/\` to `//`, so the redirect goes off-site. Passed `pnpm check` green; the loop moved on believing it fixed.
- **`83e38ab`** — `feat: implement safeNext function to guard against open redirects and add tests` — **hand-authored** correction. Resolves `next` with `new URL(raw, "http://localhost")` and keeps it only if the origin is unchanged; tests all four bypass vectors (`//evil.com`, `https://evil.com`, `/\evil.com`, `https:evil.com`). The gate never demanded this — a human caught what the author could not self-review.
- **`96982ca`** — `fix(T25): verify premortem ownership before inserting user risk` — loop-authored IDOR fix (verify the premortem belongs to the user before inserting a user risk row).

**Phase C reproduces the catch:** the new Fable reviewer reviews `facda4e`'s diff read-only and must produce the `/\evil.com` repro string plus a `reviewed:flag` (or HALT) verdict — a fresh, documented catch on code that really shipped.
