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

    reset(): void {
        this.cards = [];
        for (let d = 0; d < this.numDecks; d++) {
            this.cards.push(...new Deck().cards);
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
