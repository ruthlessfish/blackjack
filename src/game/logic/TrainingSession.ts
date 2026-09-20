import { TRAINING_DECKS } from './constants';
import { toCardView } from './card';
import { Dealer } from './dealer';
import { Hand } from './hand';
import { Shoe } from './shoe';
import { basicStrategy } from './strategy';
import type { Action, SavedTraining, TrainingView } from './types';

/** How each move is named in feedback text. */
const ACTION_NAME: Record<Action, string> = {
    hit: 'hit',
    stand: 'stand',
    double: 'double down',
    split: 'split',
};

/** Share of hands answered correctly, 0-100, or null before the first hand. */
export function accuracyPct(handsSeen: number, handsCorrect: number): number | null {
    return handsSeen ? (handsCorrect / handsSeen) * 100 : null;
}

/**
 * One Basic Strategy drill: deal a hand, take a single move, score it.
 * Only the first move is ever played, so there is no hit, no dealer
 * play-out and no money. Like `StandardGame`, it knows nothing of Phaser.
 */
export class TrainingSession {
    private shoe = new Shoe(TRAINING_DECKS);
    private player = new Hand();
    private dealer = new Dealer();
    private feedback: TrainingView['feedback'] = null;

    private handsSeen: number;
    private handsCorrect: number;
    private streak = 0;
    private bestStreak: number;

    constructor(saved: SavedTraining) {
        this.handsSeen = saved.handsSeen;
        this.handsCorrect = saved.handsCorrect;
        this.bestStreak = saved.bestStreak;
        this.deal();
    }

    /**
     * Deal the next hand. Hands with no decision to make (a player natural, or a
     * dealer natural the peek would catch) are skipped so every hand dealt is one
     * worth answering.
     */
    deal(): void {
        do {
            if (this.shoe.needsReshuffle()) this.shoe.reset();
            this.player = new Hand([this.shoe.draw(), this.shoe.draw()]);
            this.dealer.reset([this.shoe.draw(), this.shoe.draw()]);
        } while (this.player.isBlackjack || (this.dealer.shouldPeek && this.dealer.hand.isBlackjack));
        this.feedback = null;
    }

    /**
     * Score the player's move against Basic Strategy. Returns false when the move
     * is not allowed right now (already answered, or splitting a non-pair).
     */
    answer(action: Action): boolean {
        if (this.feedback !== null) return false;
        if (action === 'split' && !this.player.isPair) return false;

        // Bankroll is unlimited here, so double is always legal and split is legal for a pair.
        const advised = basicStrategy(this.player, this.dealer.upCard, true, this.player.isPair);
        const correct = advised === action;

        this.handsSeen++;
        if (correct) {
            this.handsCorrect++;
            this.streak++;
            // Best tracks the live streak, so it never lags a run still in progress.
            if (this.streak > this.bestStreak) this.bestStreak = this.streak;
        } else {
            this.streak = 0;
        }

        this.feedback = {
            correct,
            text: correct
                ? `Correct: ${ACTION_NAME[advised]}.`
                : `Basic Strategy says ${ACTION_NAME[advised]}. You chose to ${ACTION_NAME[action]}.`,
        };
        return true;
    }

    /** Zero the lifetime totals and the best streak. */
    resetStats(): void {
        this.handsSeen = 0;
        this.handsCorrect = 0;
        this.streak = 0;
        this.bestStreak = 0;
    }

    /** What is worth keeping between sessions. */
    snapshot(): SavedTraining {
        return {
            handsSeen: this.handsSeen,
            handsCorrect: this.handsCorrect,
            bestStreak: this.bestStreak,
        };
    }

    private handLabel(): string {
        if (this.player.isPair) {
            const value = this.player.cards[0].value;
            return value === 11 ? 'Pair of Aces' : `Pair of ${value}s`;
        }
        return `${this.player.isSoft ? 'Soft' : 'Hard'} ${this.player.total}`;
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
            },
            feedback: this.feedback,
            handsSeen: this.handsSeen,
            handsCorrect: this.handsCorrect,
            accuracy: accuracyPct(this.handsSeen, this.handsCorrect),
            streak: this.streak,
            bestStreak: this.bestStreak,
        };
    }
}
