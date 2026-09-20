import {
    BLACKJACK_PAYOUT,
    CHIPS,
    DEFAULT_SETTINGS,
    MAX_HANDS,
    MIN_BET,
    SWEEP_DELAY_MS,
} from './constants';
import { toCardView } from './card';
import { Dealer } from './dealer';
import { Hand } from './hand';
import { Player } from './player';
import { Shoe } from './shoe';
import type {
    Availability,
    ChipView,
    MessageKind,
    MessageView,
    Outcome,
    Phase,
    SavedTable,
    Settings,
    ViewState,
} from './types';

const BET_PROMPT = 'Place your bet to begin.';

/**
 * The Standard-mode table. Holds all state, owns the rules, and hands a
 * `ViewState` to whoever is watching through the `onChange` callback. It has
 * no idea Phaser exists, so a scene only renders the view and forwards clicks.
 */
export class StandardGame {
    private settings: Settings;
    private shoe: Shoe;
    private player = new Player();
    private dealer = new Dealer();
    private phase: Phase = 'betting';
    private bankrollWasReset = false;
    /** The message line. Part of the state, so it can never desync from a render. */
    private message: MessageView = { text: BET_PROMPT };
    /** Pending auto-sweep of the settled round, if one is still counting down. */
    private sweepTimer: ReturnType<typeof setTimeout> | null = null;

    private onChange: (state: ViewState) => void;

    constructor(onChange: (state: ViewState) => void, saved?: SavedTable) {
        this.onChange = onChange;
        this.settings = saved
            ? { decks: saved.decks, startingBalance: saved.startingBalance }
            : { ...DEFAULT_SETTINGS };
        this.shoe = new Shoe(this.settings.decks);
        this.player.startingBalance = this.settings.startingBalance;
        this.player.balance = saved ? saved.balance : this.settings.startingBalance;
    }

    /** Drop the table's timers. Called when the scene shuts down. */
    dispose(): void {
        this.cancelSweep();
    }

    /** What is worth keeping between sessions. */
    snapshot(): SavedTable {
        return { ...this.settings, balance: this.player.balance };
    }

    // ---- Betting -----------------------------------------------------------

    addBet(amount: number): void {
        if (this.phase !== 'betting') return;
        if (!CHIPS.includes(amount)) return;
        if (amount > this.player.balance - this.player.pendingBet) return;
        this.sweep();
        // The out-of-funds notice has been read once the player stakes again.
        if (this.bankrollWasReset) {
            this.bankrollWasReset = false;
            this.setMessage(BET_PROMPT);
        }
        this.player.addToBet(amount);
        this.render();
    }

    /**
     * Clear the settled round off the table. Staking a new bet sweeps the old
     * cards so the bet spot is the only bet on display.
     */
    private sweep(): void {
        this.cancelSweep();
        this.player.sweep();
        this.dealer.reset([]);
    }

    /**
     * Leave the settled round up long enough to read, then clear it. The player
     * can always outrun the timer by betting or dealing again, so the guard
     * below makes a late-firing timer harmless rather than a table-wiping bug.
     */
    private scheduleSweep(): void {
        this.cancelSweep();
        this.sweepTimer = setTimeout(() => {
            this.sweepTimer = null;
            if (this.phase !== 'betting') return;
            this.player.sweep();
            this.dealer.reset([]);
            this.render();
        }, SWEEP_DELAY_MS);
    }

    private cancelSweep(): void {
        if (this.sweepTimer !== null) {
            clearTimeout(this.sweepTimer);
            this.sweepTimer = null;
        }
    }

    clearBet(): void {
        if (this.phase !== 'betting') return;
        this.player.clearBet();
        this.render();
    }

    // ---- Settings ----------------------------------------------------------

    /**
     * Apply the settings panel's values. The shoe and the bankroll are
     * round-scoped, so they only move between hands. The panel is closed
     * mid-round, and this guards it again.
     */
    applySettings(next: Settings): void {
        if (this.phase !== 'betting') return;

        if (next.decks !== this.shoe.decks) {
            this.settings.decks = next.decks;
            this.shoe.setDecks(next.decks);
        }

        const bankroll = Math.floor(next.startingBalance);
        if (Number.isFinite(bankroll) && bankroll >= MIN_BET && bankroll !== this.settings.startingBalance) {
            this.settings.startingBalance = bankroll;
            this.player.startingBalance = bankroll;
            this.player.resetBankroll();
            this.player.clearBet();
            this.bankrollWasReset = false;
            this.setMessage(BET_PROMPT);
        }
        this.render();
    }

    deal(): void {
        if (this.phase !== 'betting' || this.player.pendingBet <= 0) return;
        this.cancelSweep();
        if (this.shoe.needsReshuffle()) this.shoe.reset();

        const bet = this.player.pendingBet;
        this.player.take(bet);
        this.player.hands = [new Hand(bet, [this.shoe.draw(), this.shoe.draw()])];
        this.player.activeIndex = 0;
        this.player.insuranceBet = 0;
        this.player.lastBet = bet;
        this.player.pendingBet = 0;
        this.dealer.reset([this.shoe.draw(), this.shoe.draw()]);

        const insuranceCost = Math.floor(bet / 2);
        if (this.dealer.upCard.isAce && this.player.canAfford(insuranceCost) && insuranceCost > 0) {
            this.phase = 'insurance';
            this.setMessage('Dealer shows an Ace. Take insurance?');
            this.render();
            return;
        }
        this.resolveOpening();
    }

    // ---- Insurance ---------------------------------------------------------

    takeInsurance(): void {
        if (this.phase !== 'insurance') return;
        this.player.insuranceBet = Math.floor(this.player.hands[0].bet / 2);
        this.player.take(this.player.insuranceBet);
        this.resolveOpening();
    }

    declineInsurance(): void {
        if (this.phase !== 'insurance') return;
        this.resolveOpening();
    }

    /** After bets/insurance are set: peek for dealer blackjack, then start play. */
    private resolveOpening(): void {
        if (this.dealer.shouldPeek && this.dealer.hand.isBlackjack) {
            this.dealer.reveal();
            this.settle();
            return;
        }
        if (this.player.hands[0].isBlackjack) {
            this.player.hands[0].resolved = true;
            this.dealer.reveal();
            this.settle();
            return;
        }
        this.phase = 'player';
        this.enterHand(0);
    }

    // ---- Player actions ----------------------------------------------------

    hit(): void {
        if (this.phase !== 'player') return;
        const hand = this.player.activeHand;
        hand.add(this.shoe.draw());
        if (hand.total >= 21) {
            hand.resolved = true;
            this.render();
            this.advance();
        } else {
            this.setMessage(this.handPrompt());
            this.render();
        }
    }

    stand(): void {
        if (this.phase !== 'player') return;
        this.player.activeHand.resolved = true;
        this.advance();
    }

    double(): void {
        if (!this.canDouble()) return;
        const hand = this.player.activeHand;
        this.player.take(hand.bet);
        hand.bet *= 2;
        hand.add(this.shoe.draw());
        hand.resolved = true;
        this.render();
        this.advance();
    }

    split(): void {
        if (!this.canSplit()) return;
        const hand = this.player.activeHand;
        const [c1, c2] = hand.cards;
        const aces = c1.isAce;
        this.player.take(hand.bet);

        const first = new Hand(hand.bet, [c1], aces);
        const second = new Hand(hand.bet, [c2], aces);
        this.player.hands.splice(this.player.activeIndex, 1, first, second);

        // Deal the active (first) hand its second card and continue.
        this.enterHand(this.player.activeIndex);
    }

    /** Make hand `i` active, dealing a second card if it just came from a split. */
    private enterHand(i: number): void {
        this.player.activeIndex = i;
        const hand = this.player.hands[i];
        if (hand.cards.length === 1) hand.add(this.shoe.draw());

        // Split aces get one card only; a two-card 21 needs no further action.
        if (hand.isSplitAces || hand.total === 21) {
            hand.resolved = true;
            this.render();
            this.advance();
            return;
        }
        this.setMessage(this.handPrompt());
        this.render();
    }

    /** The standing prompt for whichever hand the player is acting on. */
    private handPrompt(): string {
        return this.player.hands.length > 1
            ? `Playing hand ${this.player.activeIndex + 1} of ${this.player.hands.length}.`
            : 'Hit, stand, or double?';
    }

    /** Move to the next unresolved hand, or hand the turn to the dealer. */
    private advance(): void {
        for (let i = this.player.activeIndex + 1; i < this.player.hands.length; i++) {
            if (!this.player.hands[i].resolved) {
                this.enterHand(i);
                return;
            }
        }
        this.dealerTurn();
    }

    // ---- Dealer & settlement ----------------------------------------------

    private dealerTurn(): void {
        this.phase = 'dealer';

        // No need to draw when every player hand already busted.
        const anyLive = this.player.hands.some((h) => !h.isBust);
        if (anyLive) {
            this.dealer.play(this.shoe);
        } else {
            this.dealer.reveal();
        }
        this.settle();
    }

    private settle(): void {
        this.phase = 'settled';
        const dealerTotal = this.dealer.hand.total;
        const dealerBJ = this.dealer.hand.isBlackjack;
        const single = this.player.hands.length === 1;

        let netProfit = 0;
        const notes: string[] = [];

        if (this.player.insuranceBet > 0) {
            if (dealerBJ) {
                this.player.pay(this.player.insuranceBet * 3); // stake back + 2:1
                netProfit += this.player.insuranceBet * 2;
                notes.push('insurance pays');
            } else {
                netProfit -= this.player.insuranceBet;
                notes.push('insurance lost');
            }
        }

        for (const hand of this.player.hands) {
            const playerBJ = single && hand.isBlackjack;

            if (playerBJ && dealerBJ) {
                hand.outcome = 'push';
                this.player.pay(hand.bet);
            } else if (playerBJ) {
                hand.outcome = 'win';
                const winnings = Math.floor(hand.bet * BLACKJACK_PAYOUT);
                this.player.pay(hand.bet + winnings);
                netProfit += winnings;
            } else if (dealerBJ) {
                hand.outcome = 'lose';
                netProfit -= hand.bet;
            } else if (hand.isBust) {
                hand.outcome = 'lose';
                netProfit -= hand.bet;
            } else if (dealerTotal > 21 || hand.total > dealerTotal) {
                hand.outcome = 'win';
                this.player.pay(hand.bet * 2);
                netProfit += hand.bet;
            } else if (hand.total < dealerTotal) {
                hand.outcome = 'lose';
                netProfit -= hand.bet;
            } else {
                hand.outcome = 'push';
                this.player.pay(hand.bet);
            }
        }

        const blackjack = this.paidBlackjack(this.player.hands[0]);
        this.setMessage(
            this.settlementText(netProfit, dealerBJ, notes, blackjack),
            blackjack ? 'blackjack' : this.netOutcome(netProfit),
        );

        // Below the smallest chip there is no legal bet left, so the table is dead.
        if (this.player.balance < MIN_BET) {
            this.player.resetBankroll();
            this.bankrollWasReset = true;
            this.setMessage(`Out of funds. Balance reset to $${this.player.startingBalance}.`, 'lose');
        }

        this.player.insuranceBet = 0;
        this.phase = 'betting';
        // Carry the stake into the next round so the player can just hit Deal;
        // if the balance no longer covers it, start from zero instead.
        this.player.carryBet();
        this.render();
        this.scheduleSweep();
    }

    /**
     * A natural blackjack that actually paid, the one hand worth a fanfare.
     * Only an unsplit hand can be a natural, and one pushed against the
     * dealer's own blackjack is nothing to celebrate.
     */
    private paidBlackjack(hand: Hand): boolean {
        return this.player.hands.length === 1 && hand.isBlackjack && hand.outcome === 'win';
    }

    private settlementText(netProfit: number, dealerBJ: boolean, notes: string[], blackjack: boolean): string {
        const suffix = notes.length ? ` (${notes.join(', ')})` : '';
        let head: string;
        if (dealerBJ && this.player.hands.every((h) => h.outcome !== 'win')) {
            head = 'Dealer blackjack.';
        } else if (blackjack) {
            head = `Blackjack! You won $${netProfit}.`;
        } else if (netProfit > 0) {
            head = `You won $${netProfit}.`;
        } else if (netProfit < 0) {
            head = `You lost $${-netProfit}.`;
        } else {
            head = 'Break even.';
        }
        return head + suffix;
    }

    private netOutcome(netProfit: number): Outcome {
        if (netProfit > 0) return 'win';
        if (netProfit < 0) return 'lose';
        return 'push';
    }

    // ---- Availability helpers ---------------------------------------------

    /**
     * Doubling needs an untouched two-card hand: once you've hit, the play is
     * gone for good and the button goes with it. A hand that qualifies but
     * outruns the bankroll stays on screen, greyed out, so it's clear the play
     * exists and only the money is missing.
     */
    private doubleAvailability(): Availability {
        if (this.phase !== 'player') return 'unavailable';
        const hand = this.player.activeHand;
        if (hand.cards.length !== 2 || hand.isSplitAces) return 'unavailable';
        return this.player.canAfford(hand.bet) ? 'ok' : 'unaffordable';
    }

    /** Same split: a non-pair (or the hand cap) hides it, a short bankroll dims it. */
    private splitAvailability(): Availability {
        if (this.phase !== 'player') return 'unavailable';
        if (this.player.hands.length >= MAX_HANDS) return 'unavailable';
        const hand = this.player.activeHand;
        if (!hand.isPair) return 'unavailable';
        return this.player.canAfford(hand.bet) ? 'ok' : 'unaffordable';
    }

    private canDouble(): boolean {
        return this.doubleAvailability() === 'ok';
    }

    private canSplit(): boolean {
        return this.splitAvailability() === 'ok';
    }

    /**
     * Chips are live only between hands, and only up to what the balance still
     * covers once the pending stake is set aside. Deciding this here rather than
     * in the scene is what lets the scene hold no rule of its own.
     */
    private chipViews(): ChipView[] {
        const spare = this.player.balance - this.player.pendingBet;
        return CHIPS.map((amount) => ({
            amount,
            availability:
                this.phase !== 'betting' ? 'unavailable' : amount <= spare ? 'ok' : 'unaffordable',
        }));
    }

    /**
     * The discard tray, derived rather than tracked: everything gone from the shoe
     * that is not still face-up on the table. Cards move here the moment a settled
     * round is swept, without the shoe having to be told, which keeps a re-deal
     * that cancels the pending sweep from desyncing a counter.
     */
    private discardCount(): number {
        const inPlay =
            this.dealer.hand.cards.length +
            this.player.hands.reduce((s, h) => s + h.cards.length, 0);
        return Math.max(0, this.shoe.total - this.shoe.remaining - inPlay);
    }

    // ---- Rendering ---------------------------------------------------------

    private setMessage(text: string, kind?: MessageKind): void {
        this.message = { text, kind };
    }

    /** The table as the player is allowed to see it. Pure, so it can be read at any time. */
    view(): ViewState {
        const dealerHand = this.dealer.hand;
        const hidden = this.dealer.holeHidden;
        return {
            // The hole card is withheld, not merely left face-down: it never enters the view.
            dealer: dealerHand.cards.map((c, i) => (hidden && i === 1 ? null : toCardView(c))),
            dealerHidden: hidden,
            dealerTotal: dealerHand.cards.length && !hidden ? dealerHand.total : null,
            dealerSoft: !hidden && dealerHand.isSoft,
            balance: this.player.balance,
            betDisplay: this.phase === 'betting' ? this.player.pendingBet : this.player.committed,
            phase: this.phase,
            shoeRemaining: this.shoe.remaining,
            shoeTotal: this.shoe.total,
            shoeDiscarded: this.discardCount(),
            playerHands: this.player.hands.map((h, i) => ({
                cards: h.cards.map(toCardView),
                total: h.total,
                soft: h.isSoft,
                bet: h.bet,
                active: this.phase === 'player' && i === this.player.activeIndex,
                outcome: h.outcome,
                blackjack: this.paidBlackjack(h),
                label: this.player.hands.length > 1 ? `Hand ${i + 1}` : 'You',
            })),
            message: { ...this.message },
            settings: { ...this.settings },
            chips: this.chipViews(),
            can: {
                deal: this.phase === 'betting' && this.player.pendingBet > 0,
                hit: this.phase === 'player',
                stand: this.phase === 'player',
                double: this.doubleAvailability(),
                split: this.splitAvailability(),
                insurance: this.phase === 'insurance',
                clear: this.phase === 'betting' && this.player.pendingBet > 0,
                chips: this.phase === 'betting',
                settings: this.phase === 'betting',
            },
        };
    }

    private render(): void {
        this.onChange(this.view());
    }
}
