import { Card } from './card';
import type { Outcome } from './types';

/** Cards and what they add up to: the dealer's hand, and the hand a drill deals the player. */
export class Hand {
    cards: Card[];

    constructor(cards: Card[] = []) {
        this.cards = cards;
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

/** A hand the player has money on: it carries a bet, knows when the player is done with it, and how it ended. */
export class PlayerHand extends Hand {
    readonly isSplitAces: boolean;
    private stake: number;
    private finished = false;
    private gaveUp = false;
    private result?: Outcome;

    constructor(bet: number, cards: Card[] = [], isSplitAces = false) {
        super(cards);
        this.stake = bet;
        this.isSplitAces = isSplitAces;
    }

    get bet(): number {
        return this.stake;
    }

    /** True once the player has finished acting on this hand. */
    get resolved(): boolean {
        return this.finished;
    }

    get outcome(): Outcome | undefined {
        return this.result;
    }

    /** Surrendered: half the bet comes back and the hand is out of play. */
    get surrendered(): boolean {
        return this.gaveUp;
    }

    doubleBet(): void {
        this.stake *= 2;
    }

    resolve(): void {
        this.finished = true;
    }

    surrender(): void {
        this.gaveUp = true;
        this.finished = true;
    }

    settle(outcome: Outcome): void {
        this.result = outcome;
    }
}
