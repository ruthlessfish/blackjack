import {RANKS, SUITS, Card} from './card.js';

class Deck {
    constructor() {
        this.cards = [];
        this.dealt = [];
        this.discarded = [];
        this.populate();
    }

    populate() {
        this.cards = [];
        this.dealt = [];
        this.discarded = [];
        for (suit of SUITS) {
            for (rank of RANKS) {
                this.cards.push(new Card(rank, suit));
            }
        }
    }

    shuffle() {
        this.cards = this.cards.concat(this.discarded);
        this.discarded = [];
        for (let i = this.cards.length - 1; i > 0; i--) {
            let j = Math.floor(Math.random() * (i + 1));
            let temp = this.cards[i];
            this.cards[i] = this.cards[j];
            this.cards[j] = temp;
        }
    }

    deal() {
        if (this.cards.length === 0) {
            this.shuffle();
        }
        let card = this.cards.pop();
        this.dealt.push(card);
        return card;
    }

    discard() {
        this.discarded = this.discarded.concat(this.dealt);
        this.dealt = [];
    }
}

export default Deck;