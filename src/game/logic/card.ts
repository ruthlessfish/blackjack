import type { CardView, Rank, Suit } from './types';
import { RED_SUITS } from './constants';

export class Card {
    readonly rank: Rank;
    readonly suit: Suit;

    constructor(rank: Rank, suit: Suit) {
        this.rank = rank;
        this.suit = suit;
    }

    /** Base value of the card; aces counted as 11 then reduced as needed. */
    get value(): number {
        if (this.rank === 'A') return 11;
        if (this.rank === 'K' || this.rank === 'Q' || this.rank === 'J') return 10;
        return parseInt(this.rank, 10);
    }

    get isAce(): boolean {
        return this.rank === 'A';
    }

    get isRed(): boolean {
        return RED_SUITS.has(this.suit);
    }
}

export function toCardView(card: Card): CardView {
    return { rank: card.rank, suit: card.suit, red: card.isRed };
}
