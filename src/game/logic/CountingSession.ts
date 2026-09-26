import { toCardView, type Card } from './card';
import { MAX_ANSWER_MS, QUIZ_MAX_CARDS, QUIZ_MIN_CARDS } from './constants';
import { Shoe } from './shoe';
import { accuracyPct } from './TrainingSession';
import type { CountingView, CountQuestion, CountSpeed, SavedCounting } from './types';

/** The Hi-Lo tag: 2-6 count +1, 7-9 count 0, tens and aces count -1. */
export function hiLoValue(card: Card): -1 | 0 | 1 {
    const value = card.value;
    if (value <= 6) return 1;
    if (value <= 9) return 0;
    return -1;
}

/** Decks left in the shoe, to the nearest half deck, as a player judges it from the discard tray. Never below half. */
export function decksRemaining(cardsRemaining: number): number {
    return Math.max(0.5, Math.round(cardsRemaining / 26) / 2);
}

/** Running count per deck remaining, rounded toward zero. */
export function trueCount(running: number, cardsRemaining: number): number {
    // `+ 0` turns a -0 into 0, so a small negative count reads as 0 rather than "-0".
    return Math.trunc(running / decksRemaining(cardsRemaining)) + 0;
}

/** A count as it is said aloud: "+3", "0", "-2". */
export function signed(n: number): string {
    return n > 0 ? `+${n}` : `${n}`;
}

export interface CountingOptions {
    /** A ready-made shoe, so a test can stack the cards; otherwise one is built from the saved deck count. */
    shoe?: Shoe;
    /** Picks how many cards come between quizzes; `Math.random` by default. */
    random?: () => number;
    /** The clock answer times are read from; `Date.now` by default. */
    now?: () => number;
}

/**
 * Hi-Lo drill: cards come off a shoe one at a time and every so often the
 * player is asked for the running count (and, every other quiz, the true
 * count too). The scene owns the pace; this only decides what a card or an
 * answer does. Like the other modes, it knows nothing of Phaser.
 */
export class CountingSession {
    private readonly random: () => number;
    private readonly now: () => number;
    private shoe: Shoe;
    private running = 0;
    private card: Card | null = null;
    private phase: CountingView['phase'] = 'dealing';
    private question: CountQuestion | null = null;
    private feedback: CountingView['feedback'] = null;
    private reshuffled = false;
    /** Cards still to deal before the next quiz. */
    private cardsToQuiz = 0;
    /** Quizzes started this session; every second one also asks the true count. */
    private rounds = 0;
    private askedAt = 0;

    private quizzes: number;
    private correct: number;
    private streak = 0;
    private bestStreak: number;
    private totalAnswerMs: number;
    private speed: CountSpeed;

    constructor(saved: SavedCounting, opts: CountingOptions = {}) {
        this.random = opts.random ?? Math.random;
        this.now = opts.now ?? Date.now;
        this.shoe = opts.shoe ?? new Shoe(saved.decks);
        this.quizzes = saved.quizzes;
        this.correct = saved.correct;
        this.bestStreak = saved.bestStreak;
        this.totalAnswerMs = saved.totalAnswerMs;
        this.speed = saved.speed;
        this.nextInterval();
    }

    /** The running count. Not in the view, so the scene can't give it away; tests and the dev console read it here. */
    get runningCount(): number {
        return this.running;
    }

    /** Draw how many cards come before the next quiz. Never more than the shoe holds, so it can't run dry mid-count. */
    private nextInterval(): void {
        const span = QUIZ_MAX_CARDS - QUIZ_MIN_CARDS + 1;
        const cards = QUIZ_MIN_CARDS + Math.floor(this.random() * span);
        this.cardsToQuiz = Math.max(1, Math.min(cards, this.shoe.remaining));
    }

    /** Turn over the next card. Returns false outside the dealing phase. */
    dealCard(): boolean {
        if (this.phase !== 'dealing') return false;
        this.card = this.shoe.draw();
        this.running += hiLoValue(this.card);
        this.reshuffled = false;
        this.feedback = null;
        if (--this.cardsToQuiz <= 0) this.ask('running');
        return true;
    }

    private ask(question: CountQuestion): void {
        if (question === 'running') this.rounds++;
        this.phase = 'quiz';
        this.question = question;
        this.askedAt = this.now();
    }

    private get asksTrueCount(): boolean {
        return this.rounds % 2 === 0;
    }

    /** Score an answer to the current question. Returns false when nothing is being asked. */
    answer(value: number): boolean {
        if (this.phase !== 'quiz' || this.question === null) return false;

        const question = this.question;
        const expected = question === 'running' ? this.running : trueCount(this.running, this.shoe.remaining);
        const correct = value === expected;
        const elapsed = Math.min(Math.max(0, this.now() - this.askedAt), MAX_ANSWER_MS);

        this.quizzes++;
        this.totalAnswerMs += elapsed;
        if (correct) {
            this.correct++;
            this.streak++;
            if (this.streak > this.bestStreak) this.bestStreak = this.streak;
        } else {
            this.streak = 0;
        }

        const seconds = `${(elapsed / 1000).toFixed(1)}s`;
        const name = question === 'running' ? 'Running count' : 'True count';
        const detail =
            question === 'true'
                ? ` (${signed(this.running)} over ${decksRemaining(this.shoe.remaining)} decks)`
                : '';
        this.feedback = {
            correct,
            text: correct
                ? `${name} ${signed(expected)}${detail}. Correct, ${seconds}.`
                : `${name} is ${signed(expected)}${detail}. You said ${signed(value)}.`,
        };

        if (question === 'running' && this.asksTrueCount) {
            this.ask('true');
        } else {
            this.phase = 'feedback';
            this.question = null;
        }
        return true;
    }

    /** Back to dealing after feedback, shuffling first if the shoe is down to its cut card. */
    resume(): boolean {
        if (this.phase !== 'feedback') return false;
        if (this.shoe.needsReshuffle() || this.shoe.remaining === 0) this.shuffle();
        this.phase = 'dealing';
        this.feedback = null;
        this.nextInterval();
        return true;
    }

    private shuffle(): void {
        this.shoe.reset();
        this.running = 0;
        this.card = null;
        this.reshuffled = true;
    }

    /** A new shoe of `decks` decks. The count starts over and any open quiz is dropped. */
    setDecks(decks: number): void {
        this.shoe.setDecks(decks);
        this.shuffle();
        this.phase = 'dealing';
        this.question = null;
        this.feedback = null;
        this.nextInterval();
    }

    /** Only stored: the scene runs the clock. */
    setSpeed(speed: CountSpeed): void {
        this.speed = speed;
    }

    /** Zero the lifetime totals and the best streak. Deck count and speed stay. */
    resetStats(): void {
        this.quizzes = 0;
        this.correct = 0;
        this.streak = 0;
        this.bestStreak = 0;
        this.totalAnswerMs = 0;
    }

    snapshot(): SavedCounting {
        return {
            quizzes: this.quizzes,
            correct: this.correct,
            bestStreak: this.bestStreak,
            totalAnswerMs: this.totalAnswerMs,
            decks: this.shoe.decks,
            speed: this.speed,
        };
    }

    view(): CountingView {
        return {
            card: this.card ? toCardView(this.card) : null,
            phase: this.phase,
            question: this.question,
            feedback: this.feedback,
            reshuffled: this.reshuffled,
            cardsRemaining: this.shoe.remaining,
            shoeTotal: this.shoe.total,
            quizzes: this.quizzes,
            correct: this.correct,
            accuracy: accuracyPct(this.quizzes, this.correct),
            streak: this.streak,
            bestStreak: this.bestStreak,
            avgAnswerMs: this.quizzes ? this.totalAnswerMs / this.quizzes : null,
            decks: this.shoe.decks,
            speed: this.speed,
        };
    }
}
