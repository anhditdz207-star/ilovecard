# RULES_DECISIONS (owner approves)
## Platform rules decided in P0
- Kick threshold: a player is kicked after a hand when chips < base bet (cannot afford next hand). Dealer below base bet => room closes with notice.
- Disconnect: whole table pauses 15s; no return => bot finishes that hand, seat freed after hand.
- Starting chips: 100,000 per account (guest: per browser id). Bots 100,000.
## Per-game variants: filled when each game is built.
### Xì dách (defaults, owner may change via rule flags)
- Players act in seat order, dealer last. Stand allowed from 16 points (players) / 15 (dealer); max 5 cards.
- Ace = 1, 10 or 11 (best <= 21). Order: xì bàng (AA) > ngũ linh (5 cards <= 21) > xì dách (A+10pt) > points. Flag `nguLinhBeatsXiDach` (true) swaps ngũ linh / xì dách.
- Multipliers: xì dách x2, xì bàng x3, ngũ linh x3 (flags `xiDachMul`, `xiBangMul`, `nguLinhMul`).
- Dealer xì dách/xì bàng at deal ends the hand at once and compares. Player quắc always loses x1 (even if dealer quắc later). Dealer quắc pays all non-quắc players. Ties = hoà.
- Human turn timeout = stand if allowed, else forced hit. Not implemented: dealer "soi bài" (checking a player's hand), split.
