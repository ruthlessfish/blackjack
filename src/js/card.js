export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
export const SUITS = ['SPADES', 'HEARTS', 'CLUBS', 'DIAMONDS'];

class Card {
  static FRAME_WIDTH = 74;
  static FRAME_HEIGHT = 98;

  constructor(rank, suit) {
    this._rank = rank;
    this._suit = suit;
    this._faceUp = true;
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

  isFaceUp() {
    return this.faceUp;
  }

  get faceUp() {
    return this._faceUp;
  }

  set faceUp(faceUp) {
    this._faceUp = faceUp;
  }

  get value() {
    if (this.rank in RANKS.slice(0, -4)) {
      return parseInt(this.rank);
    }

    if(this.rank === 'A') {
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
    const x = RANKS.indexOf(this.rank);
    const y = SUITS.indexOf(this.suit);
    return {x, y};
  }
}

export default Card;