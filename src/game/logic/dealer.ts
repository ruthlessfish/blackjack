import { Card } from './card';
import { Hand } from './hand';

export class Dealer {
    hand = new Hand();
    holeHidden = true;

    /** The face-up card, which the player plays (and strategy advises) against. */
    get upCard(): Card {
        return this.hand.cards[0];
    }

    /** Peek for blackjack on an ace or ten-value up card. */
    get shouldPeek(): boolean {
        return this.upCard.isAce || this.upCard.value === 10;
    }

    reveal(): void {
        this.holeHidden = false;
    }

    /** Start a new round with a fresh hand, hole card hidden. */
    reset(cards: Card[]): void {
        this.hand = new Hand(cards);
        this.holeHidden = true;
    }

    /** Reveal the hole card and draw to 17 (stand on all 17s). */
    play(draw: () => Card): void {
        this.reveal();
        while (this.hand.total < 17) {
            this.hand.add(draw());
        }
    }
}
