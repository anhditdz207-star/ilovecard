# CHANGELOG
## P0 (2026-11-02) scaffold
- Monorepo pnpm; shared types/engine contract/RNG/settle; demo engine; Colyseus LobbyRoom + TableRoom (bots, dealer pick, pause 15s on drop, bot takeover, kick when broke, dealer-broke closes room); guest auth + Supabase JWT hook; web shell; CI + Pages + Render configs; 14 tests.

## P1 (2026-11-02) Bầu Cua implementation
- Added deterministic server-side Bầu Cua engine, six-tile betting, hidden dice until dealer roll, capped zero-sum settlement, bots, rules, and responsive table UI; registered game in server and lobby.
- Verification: `pnpm install`, `pnpm test` (20 tests), `pnpm typecheck`, `pnpm build`, and local `pnpm dev` startup pass. Deployment preview remains to be verified.
