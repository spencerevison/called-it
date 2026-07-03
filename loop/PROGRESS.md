# PROGRESS — called-it build log

Format: `<ISO timestamp> | T## | gates: pass|fail → blocked | <short-sha> | <one-line note>`
Appended by the loop, one line per iteration. Humans read bottom-up.

---

2026-07-02T19:21:00Z | T01 | gates: pass | 8aaea6b | Next.js 16 + TS strict + Tailwind v4 + shadcn/ui (nova preset); DESIGN.md token set extended onto shadcn defaults; pnpm check = typecheck && lint && vitest run.
2026-07-02T19:38:00Z | T02 | gates: pass | 0bcb964 | GH Actions workflow (.github/workflows/check.yml): pnpm/action-setup v11, node 22, pnpm install --frozen-lockfile && pnpm check on push/PR (no packageManager pin in package.json yet, versions hardcoded in workflow to match local toolchain).
