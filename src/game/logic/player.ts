import { STARTING_BALANCE } from './constants';
import { Hand } from './hand';

export class Player {
    /** The bankroll a reset returns to; configurable in settings. */
    startingBalance = STARTING_BALANCE;
    balance = STARTING_BALANCE;
    pendingBet = 0;
    lastBet = 0;
    insuranceBet = 0;
    hands: Hand[] = [];
    activeIndex = 0;

    get activeHand(): Hand {
        return this.hands[this.activeIndex];
    }

    /** Money on the table this round: every hand's bet plus insurance. */
    get committed(): number {
        return this.hands.reduce((s, h) => s + h.bet, 0) + this.insuranceBet;
    }

    canAfford(amount: number): boolean {
        return amount <= this.balance;
    }

    addToBet(amount: number): void {
        this.pendingBet += amount;
    }

    clearBet(): void {
        this.pendingBet = 0;
    }

    /** Take money out of the balance (staking a bet). */
    take(amount: number): void {
        this.balance -= amount;
    }

    /** Pay money into the balance (winnings and returned stakes). */
    pay(amount: number): void {
        this.balance += amount;
    }

    /** Clear the settled round's hands off the table. */
    sweep(): void {
        this.hands = [];
        this.activeIndex = 0;
    }

    /** Carry the last stake into the next round if the balance still covers it. */
    carryBet(): void {
        this.pendingBet = this.lastBet <= this.balance ? this.lastBet : 0;
    }

    resetBankroll(): void {
        this.balance = this.startingBalance;
        this.lastBet = 0;
    }
}
