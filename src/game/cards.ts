export type Suit = "♠" | "♥" | "♦" | "♣";

export interface CardData {
  id: number;
  rank: number; // 2..14 (Ace high)
  suit: Suit;
}

export const SUITS: Suit[] = ["♠", "♥", "♦", "♣"];

export const rankLabel = (r: number): string =>
  r === 14 ? "A" : r === 13 ? "K" : r === 12 ? "Q" : r === 11 ? "J" : String(r);

export const cardName = (c: CardData): string => `${rankLabel(c.rank)}${c.suit}`;

export const isRed = (s: Suit): boolean => s === "♥" || s === "♦";

export function shuffledDeck(): CardData[] {
  const deck: CardData[] = [];
  let id = 0;
  for (const suit of SUITS) {
    for (let rank = 2; rank <= 14; rank++) {
      deck.push({ id: id++, rank, suit });
    }
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

/** Decompose a bet into chip denominations (greedy). */
export function chipsForBet(bet: number): number[] {
  const out: number[] = [];
  for (const v of [500, 100, 25, 5]) {
    while (bet >= v) {
      out.push(v);
      bet -= v;
    }
  }
  return out;
}
