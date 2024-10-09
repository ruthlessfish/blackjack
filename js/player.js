class Participant {
    constructor(name = '') {
        this.name = name;
        this.hand = [];
        this.in_game = true;
    }

    addCard(card) {
        this.hand.push(card);
    }

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

    hasBlackjack() {
        return this.getScore() === 21 && this.hand.length === 2;
    }

    isBusted() {
        return this.getScore() > 21;
    }

    showHand() {
        return this.hand.map(card => card.toString()).join(', ');
    }

    reset() {
        this.hand = [];
        this.in_game = true;
    }
}

class Player extends Participant {
    constructor(name = 'Player', bankroll = 100) {
        super(name);
        this.bankroll = bankroll;
        this.bet = 0;
        this.wins = 0;
        this.losses = 0;
        this.ties = 0;
        this.blackjacks = 0;
    }

    placeBet(amount) {
        this.bet = amount;
        this.bankroll -= amount;
    }
    
    win(withBlackjack = false) {
        this.wins += 1;
        let winMultiplier = 1;
        if (withBlackjack) {
            this.blackjacks += 1;
            winMultiplier = 1.5;
        }
        self.bankroll += self.bet * (1+winMultiplier);
        self.bet = 0;
    }

    lose() {
        this.losses += 1;
        this.bet = 0;
    }

    push() {
        this.ties += 1;
        this.bankroll += this.bet;
        this.bet = 0;
    }

    doubleDown() {
        this.bankroll -= this.bet;
        this.bet *= 2;
    }

    getWinRate() {
        return this.wins / (this.wins + this.losses + this.ties) * 100;
    }
}

class Dealer extends Participant {}

export {Player, Dealer};