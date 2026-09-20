import { Card } from './card';
import type { Outcome } from './types';

export class Hand {
    bet: number;
    cards: Card[];
    readonly isSplitAces: boolean;
    resolved = false; // player has finished acting on this hand
    outcome?: Outcome;

    constructor(bet: number, cards: Card[] = [], isSplitAces = false) {
        this.bet = bet;
        this.cards = cards;
        this.isSplitAces = isSplitAces;
    }

    add(card: Card): void {
        this.cards.push(card);
    }

    /** Best hand total, softening aces (11 -> 1) to avoid busting when possible. */
    get total(): number {
        return this.tally().total;
    }

    /** True if the hand contains an ace still counted as 11. */
    get isSoft(): boolean {
        return this.tally().aces > 0;
    }

    get isBlackjack(): boolean {
        return this.cards.length === 2 && this.total === 21;
    }

    get isBust(): boolean {
        return this.total > 21;
    }

    /** Two cards of equal value, eligible to split. */
    get isPair(): boolean {
        return this.cards.length === 2 && this.cards[0].value === this.cards[1].value;
    }

    /** Sum with aces high, then softened one ace at a time; `aces` is how many are still 11. */
    private tally(): { total: number; aces: number } {
        let total = 0;
        let aces = 0;
        for (const c of this.cards) {
            total += c.value;
            if (c.isAce) aces++;
        }
        while (total > 21 && aces > 0) {
            total -= 10;
            aces--;
        }
        return { total, aces };
    }
}
