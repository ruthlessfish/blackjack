import Card, {RANKS, SUITS} from './card.js';

/**
 * Represents a deck of playing cards.
 */
class Deck {
    /**
     * Represents a deck of cards.
     * @constructor
     */
    constructor() {
        this.cards = [];
        this.dealt = [];
        this.discarded = [];
        this.populate();
    }

    /**
     * Populates the deck with a standard set of playing cards.
     */
    populate() {
        this.cards = [];
        this.dealt = [];
        this.discarded = [];
        for (let suit of SUITS) {
            for (let rank of RANKS) {
                this.cards.push(new Card(rank, suit));
            }
        }
    }

    /**
     * Shuffles the deck by randomly reordering the cards.
     */
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

    /**
     * Draws a card from the deck.
     * 
     * @param {boolean} [faceDown=false] - Whether the drawn card should be face down.
     * @returns {object} - The drawn card.
     */
    draw(faceDown = false) {
        if (this.cards.length === 0) {
            this.shuffle();
        }
        let card = this.cards.pop();
        card.faceUp = !faceDown;
        this.dealt.push(card);
        console.log('draw card', card);
        return card;
    }

    /**
     * Discards the dealt cards and adds them to the discarded pile.
     */
    discard() {
        this.discarded = this.discarded.concat(this.dealt);
        this.dealt = [];
    }
}

export default Deck;