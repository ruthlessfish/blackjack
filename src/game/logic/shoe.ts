import { RESHUFFLE_FRACTION } from './constants';
import { Card } from './card';
import { Deck } from './deck';

export class Shoe {
    private cards: Card[] = [];
    private numDecks: number;

    constructor(numDecks: number) {
        this.numDecks = numDecks;
        this.reset();
    }

    /**
     * Rebuild and shuffle the shoe. `inPlay` are cards still face-up on the
     * table (a refill that lands mid-round), which are left out so no card can
     * end up on the table twice.
     */
    reset(inPlay: readonly Card[] = []): void {
        this.cards = [];
        for (let d = 0; d < this.numDecks; d++) {
            this.cards.push(...new Deck().cards);
        }
        for (const held of inPlay) {
            const i = this.cards.findIndex((c) => c.rank === held.rank && c.suit === held.suit);
            if (i !== -1) this.cards.splice(i, 1);
        }
        this.shuffle();
    }

    private shuffle(): void {
        for (let i = this.cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
        }
    }

    setDecks(n: number): void {
        this.numDecks = n;
        this.reset();
    }

    get remaining(): number {
        return this.cards.length;
    }

    get total(): number {
        return this.numDecks * 52;
    }

    get decks(): number {
        return this.numDecks;
    }

    needsReshuffle(): boolean {
        return this.cards.length < this.total * RESHUFFLE_FRACTION;
    }

    draw(): Card {
        if (this.cards.length === 0) this.reset();
        return this.cards.pop()!;
    }
}
