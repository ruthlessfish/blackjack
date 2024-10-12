/**
 * Array of card ranks.
 * @type {string[]}
 */
export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
/**
 * Array of card suits.
 * @type {string[]}
 */
export const SUITS = ['SPADES', 'HEARTS', 'CLUBS', 'DIAMONDS'];

/**
 * Represents a playing card.
 * @class
 */
class Card {
  /**
   * The width of the card frame.
   * @type {number}
   */
  static FRAME_WIDTH = 88;
  /**
   * The height of the card frame.
   * @type {number}
   */
  static FRAME_HEIGHT = 124;

  /**
   * Represents a playing card.
   * @class
   * @param {string} rank - The rank of the card.
   * @param {string} suit - The suit of the card.
   */
  constructor(rank, suit) {
    this._rank = rank;
    this._suit = suit;
    this._faceUp = true;
  }

  /**
   * Get the rank of the card.
   *
   * @returns {string} The rank of the card.
   */
  get rank() {
    return this._rank;
  }

  /**
   * Set the rank of the card.
   *
   * @param {string} rank - The rank of the card.
   * @throws {Error} If the provided rank is invalid.
   */
  set rank(rank) {
    if (!RANKS.includes(rank)) {
      throw new Error(`Invalid rank: ${rank}`);
    }

    this._rank = rank;
  }

  /**
   * Get the suit of the card.
   *
   * @returns {string} The suit of the card.
   */
  get suit() {
    return this._suit;
  }

  /**
   * Set the suit of the card.
   *
   * @param {string} suit - The suit of the card.
   * @throws {Error} If the provided suit is invalid.
   */
  set suit(suit) {
    if (!SUITS.includes(suit)) {
      throw new Error(`Invalid suit: ${suit}`);
    }

    this._suit = suit;
  }

  flip() {
    this.faceUp = !this.faceUp;
  }

  /**
   * Checks if the card is face up.
   * @returns {boolean} True if the card is face up, false otherwise.
   */
  isFaceUp() {
    return this.faceUp;
  }

  /**
   * Get the current face-up status of the card.
   *
   * @returns {boolean} The face-up status of the card.
   */
  get faceUp() {
    return this._faceUp;
  }

  /**
   * Setter for the faceUp property.
   *
   * @param {boolean} faceUp - The new value for the faceUp property.
   */
  set faceUp(faceUp) {
    this._faceUp = faceUp;
  }

  /**
   * Get the value of the card.
   * @returns {number} The value of the card.
   */
  get value() {
    if (this.rank in RANKS.slice(0, -4)) {
      return parseInt(this.rank);
    }

    if(this.rank === 'A') {
      return 11;
    }

    return 10;
  }

  /**
   * Returns a string representation of the card.
   * @returns {string} The string representation of the card.
   */
  toString() {
    let labels = {
        'J': 'Jack',
        'Q': 'Queen',
        'K': 'King',
        'A': 'Ace'
    };

    return `${this.rank in labels ? labels[this.rank] : this.rank} of ${this.suit}s`;
  }

  /**
   * Returns the sprite offset for the card.
   * @returns {Object} The sprite offset object with x and y coordinates.
   */
  getSpriteOffset() {
    const x = RANKS.indexOf(this.rank);
    const y = SUITS.indexOf(this.suit);
    return {x, y};
  }
}

export default Card;