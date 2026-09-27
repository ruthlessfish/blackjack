import { describe, expect, it } from 'vitest';
import { Card } from '@/game/logic/card';
import { MAX_ANSWER_MS, QUIZ_MAX_CARDS, QUIZ_MIN_CARDS, RANKS } from '@/game/logic/constants';
import { CountingSession, decksRemaining, hiLoValue, trueCount } from '@/game/logic/CountingSession';
import { sanitizeCounting } from '@/game/logic/settings';
import { Shoe } from '@/game/logic/shoe';
import type { Rank, SavedCounting } from '@/game/logic/types';

const FRESH: SavedCounting = { quizzes: 0, correct: 0, bestStreak: 0, totalAnswerMs: 0, decks: 6, speed: 'medium' };

/** Deals the scripted ranks first, then the shoe's own cards. Every draw still leaves the shoe, so `remaining` is real. */
class ScriptedShoe extends Shoe {
    private readonly script: Card[];

    constructor(decks: number, ranks: Rank[]) {
        super(decks);
        this.script = ranks.map((r) => new Card(r, '♠'));
    }

    override draw(): Card {
        const real = super.draw();
        return this.script.shift() ?? real;
    }
}

/** A clock the test sets by hand. */
function clock(start = 0) {
    const c = { t: start, now: () => c.t };
    return c;
}

/** A session whose quizzes come every `QUIZ_MIN_CARDS` cards, dealing `ranks` first. */
function session(ranks: Rank[] = [], opts: { decks?: number; saved?: SavedCounting; now?: () => number } = {}) {
    const saved = opts.saved ?? FRESH;
    const shoe = new ScriptedShoe(opts.decks ?? saved.decks, ranks);
    return new CountingSession(saved, { shoe, random: () => 0, now: opts.now });
}

/** Deal until the session stops for a quiz. */
function dealToQuiz(s: CountingSession): void {
    while (s.dealCard());
}

const low = (n: number): Rank[] => Array(n).fill('5');

describe('hiLoValue', () => {
    const expected: Record<Rank, number> = {
        A: -1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 0, 8: 0, 9: 0, 10: -1, J: -1, Q: -1, K: -1,
    };
    it.each(RANKS)('%s', (rank) => {
        expect(hiLoValue(new Card(rank, '♥'))).toBe(expected[rank]);
    });

    it('sums to zero over a full deck', () => {
        expect(RANKS.reduce((sum, r) => sum + 4 * hiLoValue(new Card(r, '♠')), 0)).toBe(0);
    });
});

describe('trueCount', () => {
    it('divides by the decks remaining', () => {
        expect(decksRemaining(156)).toBe(3);
        expect(trueCount(7, 156)).toBe(2);
    });

    it('rounds toward zero', () => {
        expect(trueCount(-7, 156)).toBe(-2);
        expect(trueCount(-1, 312)).toBe(0);
    });

    it('judges the decks to the nearest half deck, never below half', () => {
        expect(decksRemaining(296)).toBe(5.5);
        expect(decksRemaining(10)).toBe(0.5);
        expect(trueCount(3, 10)).toBe(6);
    });
});

describe('dealing and quizzes', () => {
    it('stops for a running-count quiz after the interval', () => {
        const s = session();
        for (let i = 1; i < QUIZ_MIN_CARDS; i++) {
            expect(s.dealCard()).toBe(true);
            expect(s.view().phase).toBe('dealing');
        }
        expect(s.dealCard()).toBe(true);
        expect(s.view().phase).toBe('quiz');
        expect(s.view().question).toBe('running');
        expect(s.dealCard()).toBe(false);
    });

    it('draws the interval from the configured range', () => {
        const s = new CountingSession(FRESH, { random: () => 0.9999 });
        let dealt = 0;
        while (s.dealCard()) dealt++;
        expect(dealt).toBe(QUIZ_MAX_CARDS);
    });

    it('refuses an answer while dealing, and a resume outside feedback', () => {
        const s = session();
        expect(s.answer(0)).toBe(false);
        expect(s.resume()).toBe(false);
        expect(s.view().quizzes).toBe(0);
    });
});

describe('answers', () => {
    it('scores a correct running count', () => {
        const s = session(low(QUIZ_MIN_CARDS));
        dealToQuiz(s);
        expect(s.answer(QUIZ_MIN_CARDS)).toBe(true);

        const v = s.view();
        expect(v.phase).toBe('feedback');
        expect(v.feedback?.correct).toBe(true);
        expect(v.quizzes).toBe(1);
        expect(v.correct).toBe(1);
        expect(v.streak).toBe(1);
        expect(v.bestStreak).toBe(1);
        expect(v.accuracy).toBe(100);
    });

    it('scores a wrong one, ending the streak but not the best', () => {
        const s = session(low(QUIZ_MIN_CARDS), { saved: { ...FRESH, quizzes: 4, correct: 4, bestStreak: 4 } });
        dealToQuiz(s);
        s.answer(0);

        const v = s.view();
        expect(v.feedback).toEqual({ correct: false, text: `Running count is +${QUIZ_MIN_CARDS}. You said 0.` });
        expect(v.quizzes).toBe(5);
        expect(v.correct).toBe(4);
        expect(v.streak).toBe(0);
        expect(v.bestStreak).toBe(4);
    });

    it('moves the best streak as soon as the live one passes it', () => {
        const s = session([], { saved: { ...FRESH, bestStreak: 1 } });
        for (let i = 0; i < 2; i++) {
            dealToQuiz(s);
            while (s.view().phase === 'quiz') {
                const question = s.view().question;
                s.answer(question === 'running' ? s.runningCount : trueCount(s.runningCount, s.view().cardsRemaining));
            }
            s.resume();
        }
        expect(s.view().streak).toBe(3);
        expect(s.view().bestStreak).toBe(3);
    });

    it('asks the true count on every other quiz, from the cards remaining', () => {
        const s = session(low(2 * QUIZ_MIN_CARDS));
        dealToQuiz(s);
        s.answer(QUIZ_MIN_CARDS);
        s.resume();

        dealToQuiz(s);
        s.answer(2 * QUIZ_MIN_CARDS);
        expect(s.view().phase).toBe('quiz');
        expect(s.view().question).toBe('true');
        expect(s.view().feedback?.correct).toBe(true);

        // +16 over 295 cards (5.5 decks) is 2.9, which rounds toward zero.
        expect(s.view().cardsRemaining).toBe(295);
        s.answer(2);
        expect(s.view().phase).toBe('feedback');
        expect(s.view().feedback?.correct).toBe(true);
        expect(s.view().quizzes).toBe(3);
    });

    it('times each answer, capping a slow one', () => {
        const c = clock(1000);
        const s = session(low(2 * QUIZ_MIN_CARDS), { now: c.now });
        dealToQuiz(s);
        c.t += 2500;
        s.answer(QUIZ_MIN_CARDS);
        expect(s.view().avgAnswerMs).toBe(2500);

        s.resume();
        dealToQuiz(s);
        c.t += 5 * MAX_ANSWER_MS;
        s.answer(0);
        expect(s.snapshot().totalAnswerMs).toBe(2500 + MAX_ANSWER_MS);
    });
});

describe('the shoe', () => {
    it('shuffles on resume once the shoe runs low, and the count starts over', () => {
        const s = new CountingSession({ ...FRESH, decks: 1 }, { random: () => 0.9999 });
        let guard = 0;
        while (!s.view().reshuffled && guard++ < 100) {
            dealToQuiz(s);
            while (s.view().phase === 'quiz') s.answer(0);
            s.resume();
        }
        const v = s.view();
        expect(v.reshuffled).toBe(true);
        expect(v.card).toBeNull();
        expect(v.cardsRemaining).toBe(51);
        expect(s.runningCount).toBe(0);

        s.dealCard();
        expect(s.view().reshuffled).toBe(false);
    });

    it('never deals past the last card before a quiz', () => {
        const s = new CountingSession({ ...FRESH, decks: 1 }, { random: () => 0.9999 });
        let dealt = 0;
        for (let q = 0; q < 10 && !s.view().reshuffled; q++) {
            while (s.dealCard()) dealt++;
            expect(dealt).toBeLessThanOrEqual(52);
            while (s.view().phase === 'quiz') s.answer(0);
            s.resume();
        }
    });

    it('starts a fresh shoe on a deck change, dropping any open quiz', () => {
        const s = session(low(QUIZ_MIN_CARDS));
        dealToQuiz(s);
        s.setDecks(2);

        const v = s.view();
        expect(v.phase).toBe('dealing');
        expect(v.question).toBeNull();
        expect(v.decks).toBe(2);
        expect(v.cardsRemaining).toBe(103);
        expect(s.runningCount).toBe(0);
        expect(s.snapshot().decks).toBe(2);
    });
});

describe('saving', () => {
    it('round-trips through the sanitiser', () => {
        const s = session(low(QUIZ_MIN_CARDS), { decks: 2 });
        s.setSpeed('fast');
        dealToQuiz(s);
        s.answer(QUIZ_MIN_CARDS);
        const saved = s.snapshot();
        expect(sanitizeCounting(JSON.parse(JSON.stringify(saved)))).toEqual(saved);
        expect(new CountingSession(saved).snapshot()).toEqual(saved);
    });

    it('resets stats but keeps the deck count and speed', () => {
        const s = session([], { saved: { quizzes: 9, correct: 7, bestStreak: 5, totalAnswerMs: 9000, decks: 2, speed: 'slow' } });
        s.resetStats();
        expect(s.snapshot()).toEqual({ ...FRESH, decks: 2, speed: 'slow' });
    });
});
