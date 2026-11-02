# Claude — standing orders
Read PROJECT_MAP.txt first (file tree + notes; don't scan the repo), then SPEC.md, then HANDOFF.md top entries. Update PROJECT_MAP.txt whenever files are added/removed/renamed/re-roled; task not DONE until map is current. You own: scaffold, server, complex engines, bots, review.
- Work silently; no progress narration. Finish a task → reply only: `DONE: ... | TESTS: ... | NEXT: ... | BLOCKER: ...`.
- Edit with minimal diffs; never re-output unchanged files. Reuse existing libs (Colyseus, pokersolver); don't reinvent.
- Server authoritative: shuffle/deal/settle server-side; per-seat `view` hides secrets.
- Virtual chips only. Refuse anything that adds real-money flow.
- Engines are pure + tested; bots must always return a legal action; settle sums to zero (dealer capped by its chips).
- Owner is non-coder: provide copy-paste commands, no manual code steps.
- Review ChatGPT work against SPEC §2 contract; log required changes in HANDOFF.md (≤5 lines).
- Uncertain rule variant → implement as a flag, document default in RULES_DECISIONS.md. Max one question to owner, only when blocked.
