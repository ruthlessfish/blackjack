import { SUITS, RANKS } from './constants';
import { Card } from './card';

/** One standard 52-card deck, in factory order; the shoe does the shuffling. */
export class Deck {
    readonly cards: Card[] = [];

    constructor() {
        for (const suit of SUITS) {
            for (const rank of RANKS) {
                this.cards.push(new Card(rank, suit));
            }
        }
    }
}
