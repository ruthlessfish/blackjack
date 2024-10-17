/**
 * Represents a participant in the game.
 * @class
 */
class Participant {
    /**
     * Represents a player in the game.
     * @constructor
     * @param {string} [name=''] - The name of the player.
     */
    constructor(name = '') {
        this.name = name;
        this.hand = [];
        this._in_game = true;
    }

    /**
     * Get the in_game status of the player.
     *
     * @returns {boolean} The in_game status of the player.
     */
    get in_game() {
        return this._in_game;
    }

    /**
     * Setter for the in_game property.
     *
     * @param {boolean} in_game - The new value for the in_game property.
     */
    set in_game(in_game) {
        this._in_game = in_game;
    }

    /**
     * Get the player's score.
     */
    get score() {
        return this.getScore();
    }

    /**
     * Checks if the player is currently in the game.
     * @returns {boolean} True if the player is in the game, false otherwise.
     */
    isInGame() {
        return this.in_game;
    }

    /**
     * Adds a card to the player's hand.
     * @param {Object} card - The card to be added.
     */
    addCard(card) {
        this.hand.push(card);
    }

    /**
     * Calculates the score of the player's hand.
     * @returns {number} The score of the player's hand.
     */
    getScore() {
        let score = 0;
        let aces = 0;
        this.hand.forEach(card => {
            if (card.rank === 'A') {
                aces += 1;
            }
            score += card.value;
        });
        while (score > 21 && aces) {
            score -= 10;
            aces -= 1;
        }
        return score;
    }

    /**
     * Checks if the player has a blackjack.
     * @returns {boolean} True if the player has a blackjack, false otherwise.
     */
    hasBlackjack() {
        return this.getScore() === 21 && this.hand.length === 2;
    }

    /**
     * Checks if the player is busted.
     * @returns {boolean} True if the player's score is greater than 21, false otherwise.
     */
    isBusted() {
        return this.getScore() > 21;
    }

    /**
     * Returns a string representation of the player's hand.
     * @returns {string} The player's hand as a comma-separated string.
     */
    showHand() {
        return this.hand.map(card => card.toString()).join(', ');
    }

    /**
     * Resets the player's hand and sets the player as in-game.
     */
    reset() {
        this.hand = [];
        this.in_game = true;
    }
}

/**
* Represents a player in the blackjack game.
* @class
*/
class Player extends Participant {
    /**
     * Creates a new player instance.
     * @constructor
     * @param {string} [name='Player'] - The name of the player.
     * @param {number} [bankroll=100] - The initial bankroll of the player.
     */
    constructor(name = 'Player', bankroll = 100) {
        super(name);
        this.bankroll = bankroll;
        this.bet = 0;
        this.wins = 0;
        this.losses = 0;
        this.ties = 0;
        this.blackjacks = 0;
    }

    /**
     * Places a bet for the player.
     * @param {number} amount - The amount to bet.
     */
    placeBet(amount) {
        this.bet = amount;
        this.bankroll -= amount;
    }
    
    /**
     * Increases the player's win count and updates the bankroll based on the outcome of the game.
     * @param {boolean} withBlackjack - Indicates whether the player won with a blackjack.
     */
    win(withBlackjack = false) {
        this.wins += 1;
        let winMultiplier = 1;
        if (withBlackjack) {
            this.blackjacks += 1;
            winMultiplier = 1.5;
        }
        this.bankroll += this.bet * (1+winMultiplier);
        this.bet = 0;
    }

    /**
     * Updates the player's losses and resets their bet to 0.
     */
    lose() {
        this.losses += 1;
        this.bet = 0;
    }

    /**
     * Increases the number of ties, adds the current bet to the bankroll, and resets the bet to 0.
     */
    push() {
        this.ties += 1;
        this.bankroll += this.bet;
        this.bet = 0;
    }

    /**
     * Doubles the player's bet and deducts the bet amount from the bankroll.
     */
    doubleDown() {
        this.bankroll -= this.bet;
        this.bet *= 2;
    }

    /**
     * Calculates the win rate of the player.
     * 
     * @returns {number} The win rate as a percentage.
     */
    getWinRate() {
        return this.wins / (this.wins + this.losses + this.ties) * 100;
    }
}

/**
 * Represents a dealer in a blackjack game.
 * @extends Participant
 */
class Dealer extends Participant {}

export {Player, Dealer};