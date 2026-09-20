import { Card } from './card';
import { PlayerHand } from './hand';

/**
 * The player's money and hands. State is read through getters and changed
 * through methods that name what is happening, so the table never reaches in
 * and edits a field.
 */
export class Player {
    private bank: number;
    private pending = 0;
    private last = 0;
    private insurance = 0;
    private dealt: PlayerHand[] = [];
    private active = 0;

    constructor(balance: number) {
        this.bank = balance;
    }

    get balance(): number {
        return this.bank;
    }

    /** The stake being built up before the deal. */
    get pendingBet(): number {
        return this.pending;
    }

    get insuranceBet(): number {
        return this.insurance;
    }

    get hands(): readonly PlayerHand[] {
        return this.dealt;
    }

    get activeIndex(): number {
        return this.active;
    }

    get activeHand(): PlayerHand {
        return this.dealt[this.active];
    }

    /** Money on the table this round: every hand's bet plus insurance. */
    get committed(): number {
        return this.dealt.reduce((s, h) => s + h.bet, 0) + this.insurance;
    }

    canAfford(amount: number): boolean {
        return amount <= this.bank;
    }

    addToBet(amount: number): void {
        this.pending += amount;
    }

    clearBet(): void {
        this.pending = 0;
    }

    /** Take money out of the balance (staking a bet). */
    take(amount: number): void {
        this.bank -= amount;
    }

    /** Pay money into the balance (winnings and returned stakes). */
    pay(amount: number): void {
        this.bank += amount;
    }

    /** Stake the pending bet on a fresh hand of `cards`, and make it the only hand. */
    startRound(cards: Card[]): void {
        const bet = this.pending;
        this.take(bet);
        this.dealt = [new PlayerHand(bet, cards)];
        this.active = 0;
        this.insurance = 0;
        this.last = bet;
        this.pending = 0;
    }

    /** Make hand `i` the one being played. */
    activate(i: number): void {
        this.active = i;
    }

    /** Replace the active hand with the two hands it splits into. */
    split(first: PlayerHand, second: PlayerHand): void {
        this.dealt.splice(this.active, 1, first, second);
    }

    /** Stake `amount` on the dealer having a blackjack. */
    buyInsurance(amount: number): void {
        this.insurance = amount;
        this.take(amount);
    }

    clearInsurance(): void {
        this.insurance = 0;
    }

    /** Clear the settled round's hands off the table. */
    sweep(): void {
        this.dealt = [];
        this.active = 0;
    }

    /** Carry the last stake into the next round if the balance still covers it. */
    carryBet(): void {
        this.pending = this.last <= this.bank ? this.last : 0;
    }

    /** Start over from `balance`, forgetting the last stake. */
    resetBankroll(balance: number): void {
        this.bank = balance;
        this.last = 0;
    }
}
