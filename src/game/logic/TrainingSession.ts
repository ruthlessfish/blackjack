import { ASK_RECHARGE_HANDS, DEFAULT_RULES } from './constants';
import { toCardView } from './card';
import { buildHand, chartCellId, handType, pickCell, type DealtHand } from './chart';
import { Dealer } from './dealer';
import { Hand } from './hand';
import { basicStrategy } from './strategy';
import type { Action, CellId, HandFilter, SavedTraining, TrainingView } from './types';

/** How each move is named in feedback text. */
const ACTION_NAME: Record<Action, string> = {
    hit: 'hit',
    stand: 'stand',
    double: 'double down',
    split: 'split',
    surrender: 'surrender',
};

/** Share of hands answered correctly, 0-100, or null before the first hand. */
export function accuracyPct(handsSeen: number, handsCorrect: number): number | null {
    return handsSeen ? (handsCorrect / handsSeen) * 100 : null;
}

export interface TrainingOptions {
    /** Drives the cell picked and the cards built for it; `Math.random` by default. */
    random?: () => number;
    /** Replaces the whole deal, so a test can put exact cards on the table. */
    dealHand?: () => DealtHand;
}

/**
 * One Basic Strategy drill: deal a hand, take a single move, score it.
 * Only the first move is ever played, so there is no hit, no dealer
 * play-out and no money. Like `StandardGame`, it knows nothing of Phaser.
 *
 * There is no shoe: each deal picks a chart cell the filter allows (cells
 * still being missed a little more often) and builds two cards that make it.
 */
export class TrainingSession {
    private readonly dealHand: () => DealtHand;
    private player = new Hand();
    private dealer = new Dealer();
    private feedback: TrainingView['feedback'] = null;
    /** The play the dealer revealed for this hand, which takes it out of the stats. */
    private dealerSays: Action | null = null;
    /** Hands still to play before the dealer can be asked again. */
    private recharge = 0;

    private handsSeen: number;
    private handsCorrect: number;
    private streak = 0;
    private bestStreak: number;
    private filter: HandFilter;
    private misses: Record<CellId, number>;

    constructor(saved: SavedTraining, opts: TrainingOptions = {}) {
        const random = opts.random ?? Math.random;
        this.dealHand = opts.dealHand ?? (() => buildHand(pickCell(this.filter, this.misses, random), random));
        this.handsSeen = saved.handsSeen;
        this.handsCorrect = saved.handsCorrect;
        this.bestStreak = saved.bestStreak;
        this.filter = saved.filter;
        this.misses = { ...saved.misses };
        this.dealFresh();
    }

    /** Deal the next hand. */
    deal(): void {
        // The hand the dealer was asked on does not count towards the recharge.
        if (this.dealerSays === null && this.recharge > 0) this.recharge--;
        this.dealFresh();
    }

    /** Put a new hand on the table, with no bookkeeping for the one it replaces. */
    private dealFresh(): void {
        const { player, dealer } = this.dealHand();
        this.player = new Hand(player);
        this.dealer.reset(dealer);
        this.dealerSays = null;
        this.feedback = null;
    }

    /**
     * Deal only this kind of hand from now on. An unanswered hand of another kind
     * is swapped for one that fits; it was never played, so the recharge does not tick.
     * Returns true when the hand was swapped.
     */
    setFilter(filter: HandFilter): boolean {
        this.filter = filter;
        if (this.feedback !== null || filter === 'all' || handType(this.player) === filter) return false;
        this.dealFresh();
        return true;
    }

    /**
     * Reveal the Basic Strategy play. The hand still takes an answer but no
     * longer counts in the stats, the live streak ends, and the button needs
     * `ASK_RECHARGE_HANDS` more hands before it works again.
     */
    askDealer(): boolean {
        if (this.feedback !== null || this.dealerSays !== null || this.recharge > 0) return false;
        this.dealerSays = this.advised();
        this.streak = 0;
        this.recharge = ASK_RECHARGE_HANDS;
        return true;
    }

    /**
     * Bankroll is unlimited here, so double is always legal and split is legal for a pair.
     * Training always drills the default rules, which have no surrender.
     */
    private advised(): Action {
        return basicStrategy(this.player, this.dealer.upCard, { double: true, split: this.player.isPair }, DEFAULT_RULES);
    }

    /**
     * Score the player's move against Basic Strategy. Returns false when the move
     * is not allowed right now (already answered, or splitting a non-pair).
     */
    answer(action: Action): boolean {
        if (this.feedback !== null) return false;
        if (action === 'split' && !this.player.isPair) return false;

        const advised = this.advised();
        const correct = advised === action;

        // A hand the dealer answered is feedback only: it is left out of the stats.
        if (this.dealerSays === null) {
            this.handsSeen++;
            if (correct) {
                this.handsCorrect++;
                this.streak++;
                // Best tracks the live streak, so it never lags a run still in progress.
                if (this.streak > this.bestStreak) this.bestStreak = this.streak;
            } else {
                this.streak = 0;
            }
            this.recordMiss(chartCellId(this.player, this.dealer.upCard), correct);
        }

        this.feedback = {
            correct,
            text: correct
                ? `Correct: ${ACTION_NAME[advised]}.`
                : `Basic Strategy says ${ACTION_NAME[advised]}. You chose to ${ACTION_NAME[action]}.`,
        };
        return true;
    }

    /** A miss adds one to the cell; a correct answer takes one off, so a cell clears once it is learned. */
    private recordMiss(cell: CellId, correct: boolean): void {
        const count = (this.misses[cell] ?? 0) + (correct ? -1 : 1);
        if (count > 0) this.misses[cell] = count;
        else delete this.misses[cell];
    }

    /** Zero the lifetime totals, the best streak and the misses. The filter stays. */
    resetStats(): void {
        this.handsSeen = 0;
        this.handsCorrect = 0;
        this.streak = 0;
        this.bestStreak = 0;
        this.misses = {};
    }

    /** What is worth keeping between sessions. */
    snapshot(): SavedTraining {
        return {
            handsSeen: this.handsSeen,
            handsCorrect: this.handsCorrect,
            bestStreak: this.bestStreak,
            filter: this.filter,
            misses: { ...this.misses },
        };
    }

    private handLabel(): string {
        const type = handType(this.player);
        if (type === 'pair') {
            const value = this.player.cards[0].value;
            return value === 11 ? 'Pair of Aces' : `Pair of ${value}s`;
        }
        return `${type === 'soft' ? 'Soft' : 'Hard'} ${this.player.total}`;
    }

    view(): TrainingView {
        const answered = this.feedback !== null;
        return {
            dealer: this.dealer.hand.cards.map((c, i) => (i === 1 ? null : toCardView(c))),
            player: this.player.cards.map(toCardView),
            handLabel: this.handLabel(),
            can: {
                hit: !answered,
                stand: !answered,
                double: !answered,
                split: !answered && this.player.isPair,
                surrender: false,
                ask: !answered && this.dealerSays === null && this.recharge === 0,
            },
            dealerSays: this.dealerSays,
            askRecharge: this.recharge,
            feedback: this.feedback,
            handsSeen: this.handsSeen,
            handsCorrect: this.handsCorrect,
            accuracy: accuracyPct(this.handsSeen, this.handsCorrect),
            streak: this.streak,
            bestStreak: this.bestStreak,
            filter: this.filter,
        };
    }
}
