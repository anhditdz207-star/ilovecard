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
### Tiến lên (defaults chosen by Claude — owner to approve; flags in engine meta `rulesFlags`)
- 2–4 players, 13 cards each. Order 3<…<K<A<2, suits ♠<♣<♦<♥. First play must include the lowest dealt card (3♠). Play continues until one player is left (ranks 1..n).
- Chặt: tứ quý or 3 đôi thông beat a single 2; tứ quý or 4+ đôi thông beat a pair of 2s. Levels: 3 đôi thông < tứ quý < 4 đôi thông < 5 < 6.
- **Nam**: chặt chồng ON; money for chặt heo (black 2 = 1 bet, red 2 = 2 bets, paid by the 2's owner; with chặt chồng both the 2's owner and the chopped chopper pay the last chopper); cóng (never played) pays winner +2; thối heo (2s left in the last player's hand) pays winner; rank payouts 4p +3/+1/−1/−3, 3p +2/0/−2, 2p +1/−1 bets.
- **Bắc**: chặt chồng OFF; no chặt-money, no cóng, no thối; rank payouts only (same table).
- Tới trắng (instant win at deal): sảnh rồng (3→A), tứ quý heo, 6 đôi; each opponent pays 3 bets. Not implemented: 5 đôi thông tới trắng, tứ quý 3.
- Losers pay at most their chips; winners share what was collected (settleNet).
- Human timeout: pass if allowed, else play the lowest single.

### Bài cào tố (defaults by Claude, owner to approve; flags in `rulesFlags`)
- 2–8 players, 3 cards, no dealer. Ante = base bet. One betting round: check / call / raise / fold, ends when all remaining players have matched; then showdown.
- Points = sum of 3 cards mod 10 (A=1, 10/J/Q/K = 10). Ba tây (J,Q,K) highest. Tie → highest card (K>Q>J>10>…>A, suit ♥>♦>♣>♠); flag `tieBreakByCard=false` splits the pot.
- Max raises per hand 4 (flag `maxRaises`). Total bet per player capped at the smallest stack at the table → no side pots, nobody can be short.
- Last player standing wins without showing cards. Human timeout: check if free, else fold.
