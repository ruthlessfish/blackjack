export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
export const SUITS = ['SPADES', 'HEARTS', 'CLUBS', 'DIAMONDS'];

class Card {
  static FRAME_WIDTH = 73;
  static FRAME_HEIGHT = 98;

  constructor(rank, suit) {
    this._rank = rank;
    this._suit = suit;
  }

  get rank() {
    return this._rank;
  }

  set rank(rank) {
    if (!RANKS.includes(rank)) {
      throw new Error(`Invalid rank: ${rank}`);
    }

    this._rank = rank;
  }

  get suit() {
    return this._suit;
  }

  set suit(suit) {
    if (!SUITS.includes(suit)) {
      throw new Error(`Invalid suit: ${suit}`);
    }

    this._suit = suit;
  }

  get value() {
    if (this.rank in RANKS.slice(0, -4)) {
      return parseInt(this.rank);
    }

    if(this.rank === 'ACE') {
      return 11;
    }

    return 10;
  }

  toString() {
    let labels = {
        'J': 'Jack',
        'Q': 'Queen',
        'K': 'King',
        'A': 'Ace'
    };

    let myRank = this.rank in labels ? labels[this.rank] : this.rank;

    return `${myRank} of ${this.suit}s`;
  }

  getSpriteOffset() {
    const x = SUITS.indexOf(this.suit);
    const y = RANKS.indexOf(this.rank);
    return {x, y};
  }
}

export default Card;