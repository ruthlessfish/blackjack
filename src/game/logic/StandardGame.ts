import {
    BLACKJACK_PAYOUTS,
    CHIPS,
    DEALER_ACCURACY_START,
    DEALER_ACCURACY_STEP,
    DEFAULT_SETTINGS,
    MAX_HANDS,
    MIN_BET,
    SWEEP_DELAY_MS,
    TIP_AMOUNT,
} from './constants';
import { Card, toCardView } from './card';
import { Dealer } from './dealer';
import { PlayerHand } from './hand';
import { Player } from './player';
import { freshStats, parseBankroll, parseDecks, sanitizeRules } from './settings';
import { Shoe } from './shoe';
import { basicStrategy } from './strategy';
import type {
    Action,
    Availability,
    ChipView,
    MessageKind,
    MessageView,
    Outcome,
    Phase,
    SavedTable,
    Scheduler,
    Settings,
    TableRules,
    TableStats,
    ViewState,
} from './types';

const BET_PROMPT = 'Place your bet to begin.';

const timeoutScheduler: Scheduler = (fn, ms) => {
    const id = setTimeout(fn, ms);
    return () => clearTimeout(id);
};

const availableWhen = (on: boolean): Availability => (on ? 'ok' : 'unavailable');

/** How each move is named when the dealer suggests it. */
const ACTION_NAME: Record<Action, string> = {
    hit: 'hit',
    stand: 'stand',
    double: 'double down',
    split: 'split',
    surrender: 'surrender',
};

export interface TableOptions {
    /** The table to resume, or nothing for a fresh one. */
    saved?: SavedTable;
    /** A ready-made shoe, so a test can stack the deck; otherwise one is built from the settings. */
    shoe?: Shoe;
    /** How the auto-sweep is timed. A scene passes its own clock; the default is `setTimeout`. */
    schedule?: Scheduler;
    /** Where the dealer's advice gets its luck, in [0, 1). The default is `Math.random`. */
    random?: () => number;
}

/**
 * The Standard-mode table. Holds all state, owns the rules, and hands a
 * `ViewState` to whoever is watching through the `onChange` callback. It has
 * no idea Phaser exists, so a scene only renders the view and forwards clicks.
 */
export class StandardGame {
    private shoe: Shoe;
    private player: Player;
    private dealer = new Dealer();
    private startingBalance: number;
    private rules: TableRules;
    /** Results since the current bankroll began; a new bankroll starts them afresh. */
    private stats: TableStats;
    private phase: Phase = 'betting';
    private bankrollWasReset = false;
    /** The message line. Part of the state, so it can never desync from a render. */
    private message: MessageView = { text: BET_PROMPT };
    /** Cancels the pending auto-sweep of the settled round, if one is still counting down. */
    private cancelSweepTimer: (() => void) | null = null;
    /**
     * How often the dealer's advice is right, in whole percent. Tips raise it and
     * refusals lower it. It is never saved, so every new table starts it afresh.
     */
    private dealerAccuracy = DEALER_ACCURACY_START;
    /** The dealer's suggestion for the current decision, if the player asked. */
    private advice: { action: Action; correct: boolean } | null = null;
    /** The player followed good advice this round, so the dealer will hope for a tip. */
    private owesTip = false;
    /** The settlement line, held while the tip question takes over the message. */
    private settledMessage: MessageView = { text: '' };

    private readonly onChange: (state: ViewState) => void;
    private readonly schedule: Scheduler;
    private readonly random: () => number;

    constructor(onChange: (state: ViewState) => void, { saved, shoe, schedule, random }: TableOptions = {}) {
        this.onChange = onChange;
        this.schedule = schedule ?? timeoutScheduler;
        this.random = random ?? Math.random;
        this.startingBalance = saved ? saved.startingBalance : DEFAULT_SETTINGS.startingBalance;
        this.rules = { ...(saved ? saved.rules : DEFAULT_SETTINGS.rules) };
        this.shoe = shoe ?? new Shoe(saved ? saved.decks : DEFAULT_SETTINGS.decks);
        this.player = new Player(saved ? saved.balance : this.startingBalance);
        this.stats = saved ? { ...saved.stats } : freshStats(this.player.balance);
    }

    /** Drop the table's timers. Called when the scene shuts down. */
    dispose(): void {
        this.cancelSweep();
    }

    /** The player-adjustable settings. The shoe owns its own deck count, so it is read from there. */
    private get settings(): Settings {
        return { decks: this.shoe.decks, startingBalance: this.startingBalance, rules: { ...this.rules } };
    }

    /** What is worth keeping between sessions. */
    snapshot(): SavedTable {
        return { ...this.settings, balance: this.player.balance, stats: { ...this.stats } };
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
     * Draw from the shoe. If a round outruns it, the refill leaves out the cards
     * still on the table, so a card can never be dealt twice.
     */
    private draw(): Card {
        if (this.shoe.remaining === 0) this.shoe.reset(this.cardsInPlay());
        return this.shoe.draw();
    }

    private cardsInPlay(): Card[] {
        return [...this.dealer.hand.cards, ...this.player.hands.flatMap((h) => h.cards)];
    }

    /**
     * Clear the settled round off the table. Staking a new bet sweeps the old
     * cards so the bet spot is the only bet on display.
     */
    private sweep(): void {
        this.cancelSweep();
        this.clearTable();
    }

    private clearTable(): void {
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
        this.cancelSweepTimer = this.schedule(() => {
            this.cancelSweepTimer = null;
            if (this.phase !== 'betting') return;
            this.clearTable();
            this.render();
        }, SWEEP_DELAY_MS);
    }

    private cancelSweep(): void {
        this.cancelSweepTimer?.();
        this.cancelSweepTimer = null;
    }

    clearBet(): void {
        if (this.phase !== 'betting') return;
        this.player.clearBet();
        this.render();
    }

    // ---- Settings ----------------------------------------------------------

    /**
     * Apply the settings panel's values. The shoe, the bankroll and the rules
     * are round-scoped, so they only move between hands. The panel is closed
     * mid-round, and this guards it again.
     */
    applySettings(next: Settings): void {
        if (this.phase !== 'betting') return;

        const decks = parseDecks(next.decks);
        if (decks !== null && decks !== this.shoe.decks) {
            this.shoe.setDecks(decks);
        }

        const bankroll = parseBankroll(next.startingBalance);
        if (bankroll !== null && bankroll !== this.startingBalance) {
            this.startingBalance = bankroll;
            this.player.resetBankroll(bankroll);
            this.player.clearBet();
            this.stats = freshStats(bankroll);
            this.bankrollWasReset = false;
            this.setMessage(BET_PROMPT);
        }
        this.rules = sanitizeRules(next.rules, this.rules);
        this.render();
    }

    deal(): void {
        if (this.phase !== 'betting' || this.player.pendingBet <= 0) return;
        this.cancelSweep();
        if (this.shoe.needsReshuffle()) this.shoe.reset();
        this.advice = null;
        this.owesTip = false;

        this.player.startRound([this.draw(), this.draw()]);
        this.dealer.reset([this.draw(), this.draw()]);

        const insuranceCost = this.insuranceCost();
        if (this.dealer.upCard.isAce && this.player.canAfford(insuranceCost) && insuranceCost > 0) {
            this.phase = 'insurance';
            this.setMessage('Dealer shows an Ace. Take insurance?');
            this.render();
            return;
        }
        this.resolveOpening();
    }

    // ---- Insurance ---------------------------------------------------------

    /** Half the opening bet, rounded down. */
    private insuranceCost(): number {
        return Math.floor(this.player.hands[0].bet / 2);
    }

    takeInsurance(): void {
        if (this.phase !== 'insurance') return;
        this.player.buyInsurance(this.insuranceCost());
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
            this.player.hands[0].resolve();
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
        this.followAdvice('hit');
        const hand = this.player.activeHand;
        hand.add(this.draw());
        if (hand.total >= 21) {
            hand.resolve();
            this.render();
            this.advance();
        } else {
            this.setMessage(this.handPrompt());
            this.render();
        }
    }

    stand(): void {
        if (this.phase !== 'player') return;
        this.followAdvice('stand');
        this.player.activeHand.resolve();
        this.advance();
    }

    double(): void {
        if (this.doubleAvailability() !== 'ok') return;
        this.followAdvice('double');
        const hand = this.player.activeHand;
        this.player.take(hand.bet);
        hand.doubleBet();
        hand.add(this.draw());
        hand.resolve();
        this.render();
        this.advance();
    }

    /** Late surrender: give up the hand for half the bet back. The dealer has already peeked. */
    surrender(): void {
        if (this.surrenderAvailability() !== 'ok') return;
        this.followAdvice('surrender');
        this.player.activeHand.surrender();
        this.render();
        this.dealerTurn();
    }

    split(): void {
        if (this.splitAvailability() !== 'ok') return;
        this.followAdvice('split');
        const hand = this.player.activeHand;
        const [c1, c2] = hand.cards;
        const aces = c1.isAce;
        this.player.take(hand.bet);
        this.player.split(new PlayerHand(hand.bet, [c1], aces), new PlayerHand(hand.bet, [c2], aces));

        // Deal the active (first) hand its second card and continue.
        this.enterHand(this.player.activeIndex);
    }

    // ---- Ask the dealer ----------------------------------------------------

    /**
     * The dealer suggests a move for the current decision. It is the Basic
     * Strategy play `dealerAccuracy`% of the time, and otherwise some other
     * move the player could legally make.
     */
    askDealer(): void {
        if (this.phase !== 'player' || this.advice !== null) return;
        const canDouble = this.doubleAvailability() === 'ok';
        const canSplit = this.splitAvailability() === 'ok';
        const canSurrender = this.surrenderAvailability() === 'ok';
        const best = basicStrategy(
            this.player.activeHand,
            this.dealer.upCard,
            { double: canDouble, split: canSplit, surrender: canSurrender },
            this.rules,
        );

        let action = best;
        const correct = this.random() * 100 < this.dealerAccuracy;
        if (!correct) {
            const legal: Action[] = ['hit', 'stand'];
            if (canDouble) legal.push('double');
            if (canSplit) legal.push('split');
            if (canSurrender) legal.push('surrender');
            // Hit and stand are always legal, so there is always another move to offer.
            const others = legal.filter((a) => a !== best);
            action = others[Math.floor(this.random() * others.length)];
        }
        this.advice = { action, correct };
        this.setMessage(`Dealer suggests: ${ACTION_NAME[action]}.`);
        this.render();
    }

    /** Note whether a move follows good advice. Either way the advice is spent. */
    private followAdvice(action: Action): void {
        if (this.advice?.correct && this.advice.action === action) this.owesTip = true;
        this.advice = null;
    }

    /** Tip the dealer for advice that paid off; the dealer's advice gets better. */
    tipDealer(): void {
        if (this.phase !== 'tip') return;
        this.player.take(TIP_AMOUNT);
        this.dealerAccuracy = Math.min(100, this.dealerAccuracy + DEALER_ACCURACY_STEP);
        this.setMessage(`${this.settledMessage.text} Thanks for the tip!`, this.settledMessage.kind);
        this.finishRound();
    }

    /** Refuse the tip; the dealer's advice gets worse. */
    declineTip(): void {
        if (this.phase !== 'tip') return;
        this.dealerAccuracy = Math.max(0, this.dealerAccuracy - DEALER_ACCURACY_STEP);
        this.setMessage(this.settledMessage.text, this.settledMessage.kind);
        this.finishRound();
    }

    /** Make hand `i` active, dealing a second card if it just came from a split. */
    private enterHand(i: number): void {
        this.player.activate(i);
        const hand = this.player.hands[i];
        if (hand.cards.length === 1) hand.add(this.draw());

        // Split aces get one card only; a two-card 21 needs no further action.
        if (hand.isSplitAces || hand.total === 21) {
            hand.resolve();
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

        // No need to draw when every player hand already busted or was surrendered.
        const anyLive = this.player.hands.some((h) => !h.isBust && !h.surrendered);
        if (anyLive) {
            this.dealer.play(() => this.draw(), this.rules.dealerHitsSoft17);
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
        const insuranceBet = this.player.insuranceBet;

        let netProfit = 0;
        const notes: string[] = [];

        if (insuranceBet > 0) {
            if (dealerBJ) {
                this.player.pay(insuranceBet * 3); // stake back + 2:1
                netProfit += insuranceBet * 2;
                notes.push('insurance pays');
            } else {
                netProfit -= insuranceBet;
                notes.push('insurance lost');
            }
        }

        for (const hand of this.player.hands) {
            const playerBJ = single && hand.isBlackjack;

            if (hand.surrendered) {
                hand.settle('lose');
                const refund = Math.floor(hand.bet / 2);
                this.player.pay(refund);
                netProfit -= hand.bet - refund;
                notes.push(`surrendered, $${refund} returned`);
            } else if (playerBJ && dealerBJ) {
                hand.settle('push');
                this.player.pay(hand.bet);
            } else if (playerBJ) {
                hand.settle('win');
                const winnings = Math.floor(hand.bet * BLACKJACK_PAYOUTS[this.rules.blackjackPays]);
                this.player.pay(hand.bet + winnings);
                netProfit += winnings;
            } else if (dealerBJ) {
                hand.settle('lose');
                netProfit -= hand.bet;
            } else if (hand.isBust) {
                hand.settle('lose');
                netProfit -= hand.bet;
            } else if (dealerTotal > 21 || hand.total > dealerTotal) {
                hand.settle('win');
                this.player.pay(hand.bet * 2);
                netProfit += hand.bet;
            } else if (hand.total < dealerTotal) {
                hand.settle('lose');
                netProfit -= hand.bet;
            } else {
                hand.settle('push');
                this.player.pay(hand.bet);
            }
        }

        const blackjack = this.paidBlackjack(this.player.hands[0]);
        this.count(netProfit, blackjack);
        this.setMessage(
            this.settlementText(netProfit, dealerBJ, notes, blackjack),
            blackjack ? 'blackjack' : this.netOutcome(netProfit),
        );
        this.player.clearInsurance();

        // Good advice followed: hold the result on the table while the dealer waits for a tip.
        const tipDue = this.owesTip && this.player.balance >= TIP_AMOUNT;
        this.owesTip = false;
        if (tipDue) {
            this.phase = 'tip';
            this.settledMessage = { ...this.message };
            this.setMessage(`${this.message.text} Tip the dealer $${TIP_AMOUNT} for the advice?`, this.message.kind);
            this.render();
            return;
        }
        this.finishRound();
    }


    /** Close the round: check the bankroll, carry the bet, and start the betting phase. */
    private finishRound(): void {
        // Below the smallest chip there is no legal bet left, so the table is dead.
        if (this.player.balance < MIN_BET) {
            this.player.resetBankroll(this.startingBalance);
            this.bankrollWasReset = true;
            // Keep the result of the hand that broke the player; the notice follows it.
            this.setMessage(
                `${this.message.text} Out of funds. Balance reset to $${this.startingBalance}.`,
                'lose',
            );
        }

        this.stats.peakBalance = Math.max(this.stats.peakBalance, this.player.balance);
        this.phase = 'betting';
        // Carry the stake into the next round so the player can just hit Deal;
        // if the balance no longer covers it, start from zero instead.
        this.player.carryBet();
        this.render();
        this.scheduleSweep();
    }

    /** Add a settled round to the stats, once per round by its net result. */
    private count(netProfit: number, blackjack: boolean): void {
        const s = this.stats;
        s.rounds++;
        const outcome = this.netOutcome(netProfit);
        if (outcome === 'win') s.wins++;
        else if (outcome === 'lose') s.losses++;
        else s.pushes++;
        if (blackjack) s.blackjacks++;
        s.biggestWin = Math.max(s.biggestWin, netProfit);
    }

    /**
     * A natural blackjack that actually paid, the one hand worth a fanfare.
     * Only an unsplit hand can be a natural, and one pushed against the
     * dealer's own blackjack is nothing to celebrate.
     */
    private paidBlackjack(hand: PlayerHand): boolean {
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
        if (this.player.hands.length > 1 && !this.rules.doubleAfterSplit) return 'unavailable';
        return this.player.canAfford(hand.bet) ? 'ok' : 'disabled';
    }

    /** Only the untouched opening hand can surrender: not after a hit, and not after a split. */
    private surrenderAvailability(): Availability {
        if (this.phase !== 'player' || !this.rules.surrender) return 'unavailable';
        const single = this.player.hands.length === 1;
        return single && this.player.activeHand.cards.length === 2 ? 'ok' : 'unavailable';
    }

    /** Same split: a non-pair (or the hand cap) hides it, a short bankroll dims it. */
    private splitAvailability(): Availability {
        if (this.phase !== 'player') return 'unavailable';
        if (this.player.hands.length >= MAX_HANDS) return 'unavailable';
        const hand = this.player.activeHand;
        if (!hand.isPair) return 'unavailable';
        return this.player.canAfford(hand.bet) ? 'ok' : 'disabled';
    }

    /** Deal and Clear belong to the betting phase, and only work once there is a stake down. */
    private betControlAvailability(): Availability {
        if (this.phase !== 'betting') return 'unavailable';
        return this.player.pendingBet > 0 ? 'ok' : 'disabled';
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
                this.phase !== 'betting' ? 'unavailable' : amount <= spare ? 'ok' : 'disabled',
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
            // While a tip is pending the stakes are already paid out, so none are on the table.
            betDisplay:
                this.phase === 'betting'
                    ? this.player.pendingBet
                    : this.phase === 'tip'
                      ? 0
                      : this.player.committed,
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
                surrendered: h.surrendered,
                label: this.player.hands.length > 1 ? `Hand ${i + 1}` : 'You',
            })),
            advice: this.advice?.action ?? null,
            message: { ...this.message },
            settings: this.settings,
            stats: { ...this.stats },
            chips: this.chipViews(),
            can: {
                deal: this.betControlAvailability(),
                clear: this.betControlAvailability(),
                hit: availableWhen(this.phase === 'player'),
                stand: availableWhen(this.phase === 'player'),
                double: this.doubleAvailability(),
                split: this.splitAvailability(),
                surrender: this.surrenderAvailability(),
                insurance: availableWhen(this.phase === 'insurance'),
                ask: this.phase !== 'player' ? 'unavailable' : this.advice === null ? 'ok' : 'disabled',
                tip: availableWhen(this.phase === 'tip'),
                settings: this.phase === 'betting',
            },
        };
    }

    private render(): void {
        this.onChange(this.view());
    }
}
