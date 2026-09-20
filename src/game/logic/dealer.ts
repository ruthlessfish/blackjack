import type { Action } from './types';
import { Card } from './card';
import { Hand } from './hand';
import { Shoe } from './shoe';
import { basicStrategy } from './strategy';

export class Dealer {
    hand = new Hand(0);
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
        this.hand = new Hand(0, cards);
        this.holeHidden = true;
    }

    /** Basic Strategy advice for a player hand facing this dealer's up card. */
    advise(hand: Hand, canDouble: boolean, canSplit: boolean): Action {
        return basicStrategy(hand, this.upCard, canDouble, canSplit);
    }

    /** Reveal the hole card and draw to 17 (stand on all 17s). */
    play(shoe: Shoe): void {
        this.reveal();
        while (this.hand.total < 17) {
            this.hand.add(shoe.draw());
        }
    }
}
